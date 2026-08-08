import sys

with open("src/app/kitchen/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add getStarterQty helper
helper_code = """
function getStarterQty(starters: string[], starter: string): number {
  if (starter === "Waffles with Treacle") return 2;
  const pastrySet = new Set(["Cakes", "Buns", "Pastries"]);
  if (pastrySet.has(starter)) {
    const pastryItems = starters.filter(s => pastrySet.has(s));
    if (pastryItems.length === 1) return 2;
  }
  return 1;
}

export default function KitchenDashboard() {"""

content = content.replace("export default function KitchenDashboard() {", helper_code)

# 1. Update generateProductionSummary (line ~168)
old_gen = """            if (order.starters) {
              order.starters.forEach(s => {
                const starterName = (s === "Fruit Platter" && order.isKidFruitPlatter) ? "Fruit Platter (Kid's Portion)" : s;
                const qty = s === "Waffles with Treacle" ? 2 : 1;
                starterCounts[starterName] = (starterCounts[starterName] || 0) + qty;
              });
            }"""

new_gen = """            if (order.starters) {
              order.starters.forEach(s => {
                const starterName = (s === "Fruit Platter" && order.isKidFruitPlatter) ? "Fruit Platter (Kid's Portion)" : s;
                const qty = getStarterQty(order.starters, s);
                starterCounts[starterName] = (starterCounts[starterName] || 0) + qty;
              });
            }"""
content = content.replace(old_gen, new_gen)

# 2. Update sendToWhatsApp
old_wa = """      } else {
        text += `STARTERS\\n`;
        if (order.starters && order.starters.length > 0) {
          order.starters.forEach(s => {
            if (s === "Fruit Platter" && order.isKidFruitPlatter) {
              text += `• Fruit Platter (Kid's Portion)\\n`;
            } else {
              text += `• ${s}\\n`;
            }
          });
        }"""

new_wa = """      } else {
        text += `STARTERS\\n`;
        if (order.starters && order.starters.length > 0) {
          order.starters.forEach(s => {
            const qty = getStarterQty(order.starters, s);
            const qtyStr = qty > 1 ? ` (x${qty})` : '';
            if (s === "Fruit Platter" && order.isKidFruitPlatter) {
              text += `• Fruit Platter (Kid's Portion)${qtyStr}\\n`;
            } else {
              text += `• ${s}${qtyStr}\\n`;
            }
          });
        }"""
content = content.replace(old_wa, new_wa)

# 3. Update order card UI rendering
old_ui = """                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">Starters</h4>
                                  {order.starters.length > 0 ? (
                                    <ul className="list-disc list-inside text-sm text-[var(--stone-900)] space-y-1">
                                      {order.starters.map(s => (
                                        <li key={s}>{s === "Fruit Platter" && order.isKidFruitPlatter ? "Fruit Platter (Kid's Portion)" : s}</li>
                                      ))}
                                    </ul>
                                  ) : ("""

new_ui = """                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">Starters</h4>
                                  {order.starters.length > 0 ? (
                                    <ul className="list-disc list-inside text-sm text-[var(--stone-900)] space-y-1">
                                      {order.starters.map(s => {
                                        const qty = getStarterQty(order.starters, s);
                                        return (
                                          <li key={s}>
                                            {s === "Fruit Platter" && order.isKidFruitPlatter ? "Fruit Platter (Kid's Portion)" : s}
                                            {qty > 1 && <span className="ml-1 text-[var(--stone-500)] text-xs font-semibold">(x{qty})</span>}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : ("""
content = content.replace(old_ui, new_ui)

with open("src/app/kitchen/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
