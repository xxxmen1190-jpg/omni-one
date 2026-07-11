/**
 * Marketplace — Omni One Frontend
 * 
 * Interface for discovering and installing Agents, Skills, and Plugins.
 */

import React, { useState, useEffect } from "react";

interface MarketplaceItem {
  id: string;
  type: "AGENT" | "SKILL" | "PLUGIN";
  name: string;
  description: string;
  author: string;
  rating: number;
  installCount: number;
  category: string;
  iconUrl?: string;
}

export const Marketplace: React.FC = () => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`/api/marketplace?type=${filter === "ALL" ? "" : filter}`);
        const data = await res.json();
        setItems(data.data.items);
      } catch (err) {
        console.error("Failed to fetch marketplace items", err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [filter]);

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Omni Marketplace</h1>
          <p className="text-sm text-ink-500">Discover and extend your AI ecosystem</p>
        </div>
        <div className="flex bg-ink-900 p-1 rounded-xl border border-ink-800">
          {["ALL", "AGENT", "SKILL", "PLUGIN"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filter === f ? "bg-blue-600 text-white shadow-lg" : "text-ink-500 hover:text-ink-300"
              }`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}s
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-ink-900/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <MarketplaceCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

const MarketplaceCard: React.FC<{ item: MarketplaceItem }> = ({ item }) => {
  return (
    <div className="group bg-ink-900 border border-ink-800 rounded-2xl p-5 hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/5">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
          {item.type === "AGENT" ? "🤖" : item.type === "SKILL" ? "⚡" : "🔌"}
        </div>
        <span className="text-[10px] px-2 py-0.5 bg-ink-800 text-ink-400 rounded-full font-medium">
          {item.category}
        </span>
      </div>
      <h3 className="text-lg font-bold text-ink-100 mb-1">{item.name}</h3>
      <p className="text-xs text-ink-500 mb-4 line-clamp-2">{item.description}</p>
      
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-ink-800/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-yellow-500">★</span>
            <span className="text-xs font-bold text-ink-200">{item.rating.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-ink-500 text-[10px]">📥</span>
            <span className="text-xs text-ink-400">{item.installCount.toLocaleString()}</span>
          </div>
        </div>
        <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors">
          Install
        </button>
      </div>
    </div>
  );
};
