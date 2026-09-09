(function(root) {
  'use strict';
  function createStore(client, room, onRows, onStatus) {
    let active = true, running = null, dirty = false, realtime = false;
    async function read() {
      const rows = [], pageSize = 500;
      for (let start = 0; ; start += pageSize) {
        const { data, error } = await client.from('trip_expenses')
          .select('id,room_code,title,amount,payer,participants,category,created_at')
          .eq('room_code', room).order('created_at', { ascending: false })
          .order('id', { ascending: false }).range(start, start + pageSize - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < pageSize) break;
      }
      const unique = [...new Map(rows.map(row => [String(row.id), row])).values()];
      unique.forEach(row => {
        if (row.room_code !== room) throw new Error('收到非本房間帳目。');
        root.TripCore.validate(row);
      });
      return unique;
    }
    function refresh() {
      if (!active) return Promise.resolve();
      dirty = true;
      if (running) return running;
      running = (async () => {
        while (dirty && active) {
          dirty = false;
          try {
            const rows = await read();
            if (!active) return;
            if (dirty) continue;
            onRows(rows);
            onStatus(realtime ? '即時同步中' : '已讀取帳目；定期同步中', true);
          } catch (error) {
            if (active) onStatus('同步失敗，請重試：' + error.message, false);
          }
        }
      })().finally(() => { running = null; });
      return running;
    }
    const channel = client.channel('donggang-' + room + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_expenses', filter: 'room_code=eq.' + room }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trip_expenses', filter: 'room_code=eq.' + room }, refresh)
      // DELETE 不以 room_code 篩選；RLS 下舊列可能只有主鍵。收到事件後重新讀取本房間。
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'trip_expenses' }, refresh)
      .subscribe(status => {
        if (!active) return;
        realtime = status === 'SUBSCRIBED';
        if (realtime) refresh(); // 訂閱成功及重新連線後補讀，消除初始讀取的空窗。
        else onStatus('即時連線恢復中；每 15 秒重新讀取', null);
      });
    return {
      refresh,
      async insert(expense) {
        root.TripCore.validate(expense);
        const { data, error } = await client.from('trip_expenses').insert({ ...expense, room_code: room }).select('id').single();
        if (error) throw error;
        await refresh(); return data;
      },
      async remove(id) {
        const { data, error } = await client.from('trip_expenses').delete().eq('room_code', room).eq('id', id).select('id');
        if (error) throw error;
        await refresh(); return data;
      },
      close() { active = false; return client.removeChannel(channel); }
    };
  }
  root.TripStore = { createStore };
  if (typeof module !== 'undefined') module.exports = root.TripStore;
})(globalThis);
