"use client";
import Link from "next/link";
import { WalletConnect } from "./walletConnect";
import { useRole } from "@/contexts/RoleContext";
import { Settings } from "lucide-react";

export default function DashboardHeader() {
  const { setUserRole } = useRole();

  const handleRoleSwitch = () => {
    setUserRole(null); // This will trigger role selection
  };

  return (
    <header className="h-16 bg-[var(--card-background)] border-b border-[var(--border-color)] flex items-center justify-between px-6">
      {/* Left side - Seller's Dashboard */}
      <div>
        <h1 className="text-white font-semibold text-lg">Seller&apos;s Dashboard</h1>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center space-x-4">
        {/* Register Your IP Button */}
        <Link href="/store">
          <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 003 3v8a3 3 0 01-6 0V4a3 3 0 013-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" strokeWidth={2} />
              <line x1="8" y1="23" x2="16" y2="23" strokeWidth={2} />
            </svg>
            <span>Register Your IP</span>
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
