"use client";
import { useRole } from "@/contexts/RoleContext";
import { ShoppingCart, Music } from "lucide-react";

export default function RoleSelection() {
  const { setUserRole } = useRole();

  const handleRoleSelect = (role: 'buyer' | 'seller') => {
    setUserRole(role);
  };

  return (
    <div className="min-h-screen bg-[var(--main-background)] flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">SONIC IP</h1>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Choose Your Role</h2>
          <p className="text-gray-400 text-lg">
            Select how you&apos;d like to use SONIC IP platform
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Buyer Card */}
          <div 
            onClick={() => handleRoleSelect('buyer')}
            className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-8 cursor-pointer hover:border-blue-500 hover:scale-105 transition-all duration-300 group"
          >
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Buyer</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Discover and purchase unique audio intellectual property from creators worldwide. 
                Build your collection of exclusive music assets.
              </p>
              <div className="space-y-3 text-left">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300 text-sm">Browse audio marketplace</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300 text-sm">Purchase with crypto</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300 text-sm">Own exclusive rights</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300 text-sm">Track your investments</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seller Card */}
          <div 
            onClick={() => handleRoleSelect('seller')}
            className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-xl p-8 cursor-pointer hover:border-orange-500 hover:scale-105 transition-all duration-300 group"
          >
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Music className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Seller</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Create, tokenize, and sell your original audio content. 
                Turn your musical creativity into valuable digital assets.
              </p>
              <div className="space-y-3 text-left">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-300 text-sm">Record & upload audio</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-300 text-sm">Set your own prices</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-300 text-sm">Tokenize on blockchain</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-300 text-sm">Earn from sales</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-gray-500 text-sm">
            You can change your role anytime from the settings
          </p>
        </div>
      </div>
    </div>
  );
}
