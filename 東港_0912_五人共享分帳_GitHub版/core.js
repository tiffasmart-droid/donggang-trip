(function(root) {
  'use strict';
  function cents(value) {
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('金額請填正數，最多兩位小數。');
    const n = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(n) || n <= 0 || n > 10000000000) throw new Error('金額需大於 0，且不超過 NT$100,000,000。');
    return n;
  }
  function validate(e) {
    cents(e.amount);
    if (!Number.isInteger(e.payer) || e.payer < 0 || e.payer > 4) throw new Error('付款人成員編號有誤。');
    if (!Array.isArray(e.participants) || !e.participants.length || new Set(e.participants).size !== e.participants.length || e.participants.some(i => !Number.isInteger(i) || i < 0 || i > 4)) throw new Error('分帳成員需為 0～4，且不可重複或空白。');
    if (typeof e.title !== 'string' || !e.title.trim() || e.title.length > 60) throw new Error('項目請填 1～60 個字。');
    if (typeof e.category !== 'string' || e.category.length > 20) throw new Error('分類資料有誤。');
    return e;
  }
  function minimumTransfers(net) {
    let best = null;
    function search(b, path) {
      if (b.every(n => n === 0)) { if (!best || path.length < best.length) best = path; return; }
      if (best && path.length >= best.length) return;
      for (let from = 0; from < 5; from++) if (b[from] < 0) {
        for (let to = 0; to < 5; to++) if (b[to] > 0) {
          const amount = Math.min(-b[from], b[to]);
          const next = b.slice(); next[from] += amount; next[to] -= amount;
          search(next, [...path, { from, to, amt: amount / 100 }]);
        }
      }
    }
    search(net.slice(), []);
    return best || [];
  }
  function calculate(expenses) {
    const net = Array(5).fill(0); let total = 0;
    for (const e of expenses) {
      validate(e);
      const amount = cents(e.amount), people = [...e.participants].sort((a,b) => a-b);
      total += amount; net[e.payer] += amount;
      const each = Math.floor(amount / people.length), extra = amount % people.length;
      people.forEach((id, index) => net[id] -= each + (index < extra ? 1 : 0));
    }
    if (!Number.isSafeInteger(total)) throw new Error('帳目總金額超出安全計算範圍。');
    return { total: total / 100, net: net.map(n => n / 100), tx: minimumTransfers(net) };
  }
  root.TripCore = { cents, validate, calculate, minimumTransfers };
  if (typeof module !== 'undefined') module.exports = root.TripCore;
})(globalThis);
