import sys

with open("src/app/kitchen/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old_ui = """                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">Starters</h4>
                                  <ul className="list-disc list-inside text-sm text-[var(--stone-900)] space-y-1">
                                    {order.starters.map(s => (
                                      <li key={s}>{s === "Fruit Platter" && order.isKidFruitPlatter ? "Fruit Platter (Kid's Portion)" : s}</li>
                                    ))}
                                  </ul>"""

new_ui = """                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">Starters</h4>
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
                                  </ul>"""

content = content.replace(old_ui, new_ui)

with open("src/app/kitchen/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
