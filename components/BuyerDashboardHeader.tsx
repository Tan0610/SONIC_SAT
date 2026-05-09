"use client";
import Link from "next/link";
import { WalletConnect } from "./walletConnect";
import { useRole } from "@/contexts/RoleContext";
import { Settings } from "lucide-react";

export default function BuyerDashboardHeader() {
  const { setUserRole } = useRole();

  const handleRoleSwitch = () => {
    setUserRole(null); // This will trigger role selection
  };

  return (
    <header className="h-16 bg-[var(--card-background)] border-b border-[var(--border-color)] flex items-center justify-between px-6">
      {/* Left side - Buyer's Dashboard */}
      <div>
        <h1 className="text-white font-semibold text-lg">Buyer&apos;s Dashboard</h1>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center space-x-4">
        {/* Browse IPs Button */}
        <Link href="/marketplace">
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Browse IPs</span>
          </button>
        </Link>

        {/* Role Switch Button */}
        <button 
          onClick={handleRoleSwitch}
          className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700 border border-gray-600 hover:border-gray-400"
          title="Switch Role"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Wallet Connect */}
        <WalletConnect />
      </div>
    </header>
  );
}
