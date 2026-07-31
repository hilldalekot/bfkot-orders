import sys

with open("src/app/kitchen/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. State
content = content.replace(
    "const [extraMeals, setExtraMeals] = useState<{ drivers: number; staff: number }>({ drivers: 0, staff: 0 });",
    "const [extraMeals, setExtraMeals] = useState<{ drivers: number; staff: number }>({ drivers: 0, staff: 0 });\n  const [filterTab, setFilterTab] = useState<'active' | 'completed'>('active');"
)

# 2. Header and Buttons
old_header = """        <header className="mb-10 flex justify-between items-end border-b border-[var(--stone-200)] pb-6">
          <div>
            <Link href="/" className="inline-flex items-center space-x-1 text-sm font-medium text-[var(--stone-500)] hover:text-[var(--stone-900)] transition-colors mb-4">
              <span>&larr; Home</span>
            </Link>
            <h1 className="text-3xl font-light text-[var(--stone-900)] tracking-wide">Kitchen Dashboard</h1>
            <p className="text-[var(--stone-800)] mt-2 font-light">Real-time order monitoring</p>
          </div>
          <div className="text-sm font-medium text-[var(--stone-800)] flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span>Live updates active</span>
          </div>
        </header>

        {/* Production Summary Toggle */}
        <div className="mb-8 flex justify-end">"""

new_header = """        <header className="mb-8 flex justify-between items-end border-b border-[var(--stone-200)] pb-6">
          <div>
            <Link href="/" className="inline-flex items-center space-x-1 text-sm font-medium text-[var(--stone-500)] hover:text-[var(--stone-900)] transition-colors mb-4">
              <span>&larr; Home</span>
            </Link>
            <h1 className="text-3xl font-light text-[var(--stone-900)] tracking-wide">Kitchen Dashboard</h1>
            <p className="text-[var(--stone-800)] mt-2 font-light">Real-time order monitoring</p>
          </div>
          <div className="flex flex-col items-end space-y-4">
            <div className="text-sm font-medium text-[var(--stone-800)] flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span>Live updates active</span>
            </div>
          </div>
        </header>

        {/* Filters and Summary Toggle */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex space-x-2">
            <button 
              onClick={() => setFilterTab('active')}
              className={`px-5 py-2.5 text-sm font-medium rounded-full transition-colors ${filterTab === 'active' ? 'bg-[var(--accent-gold)] text-[var(--stone-900)] shadow-sm' : 'bg-white text-[var(--stone-500)] border border-[var(--stone-200)] hover:bg-[var(--stone-100)]'}`}
            >
              Active Orders
            </button>
            <button 
              onClick={() => setFilterTab('completed')}
              className={`px-5 py-2.5 text-sm font-medium rounded-full transition-colors ${filterTab === 'completed' ? 'bg-green-600 text-white shadow-sm' : 'bg-white text-[var(--stone-500)] border border-[var(--stone-200)] hover:bg-[var(--stone-100)]'}`}
            >
              Completed Orders
            </button>
          </div>"""
content = content.replace(old_header, new_header)

# 3. Filtering logic
old_list = """        {loading ? (
          <div className="text-center py-20 text-[var(--stone-800)]">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[var(--stone-200)] shadow-sm">
            <h3 className="text-xl text-[var(--stone-900)] font-light">No Active Orders</h3>
            <p className="text-[var(--stone-800)] mt-2">Waiting for new requests...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(
              orders.reduce((acc, order) => {"""

new_list = """        {loading ? (
          <div className="text-center py-20 text-[var(--stone-800)]">Loading orders...</div>
        ) : (() => {
          const filteredOrders = orders.filter(order => filterTab === 'active' ? order.status !== 'Completed' : order.status === 'Completed');
          
          if (filteredOrders.length === 0) {
            return (
              <div className="text-center py-20 bg-white rounded-2xl border border-[var(--stone-200)] shadow-sm">
                <h3 className="text-xl text-[var(--stone-900)] font-light">No {filterTab === 'active' ? 'Active' : 'Completed'} Orders</h3>
                <p className="text-[var(--stone-800)] mt-2">
                  {filterTab === 'active' ? 'Waiting for new requests...' : 'No orders have been completed yet today.'}
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-12">
              {Object.entries(
                filteredOrders.reduce((acc, order) => {"""
content = content.replace(old_list, new_list)

# 4. Closing tags
old_tail = """              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}"""

new_tail = """              );
            })}
          </div>
          );
        })()}
      </div>
    </div>
  );
}"""
content = content.replace(old_tail, new_tail)

with open("src/app/kitchen/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
