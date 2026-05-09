"use client";
export const dynamic = "force-dynamic";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import FeaturedCard from "@/components/FeaturedCard";
import ContentList from "@/components/ContentList";
import { StatCard } from "@/components/StatCard";
import AppRouter from "@/components/AppRouter";
import { useActiveListings } from "@/hooks/useActiveListings";
import { ipfsToHttp } from "@/lib/ipfsGateway";
import { formatEther } from "viem";
import { FileText, TrendingUp } from "lucide-react";

export default function Home() {
  const { listings } = useActiveListings();

  // Most recent listing (newest tokenId).
  const mostRecent = [...listings].sort((a, b) =>
    a.tokenId < b.tokenId ? 1 : a.tokenId > b.tokenId ? -1 : 0
  )[0];

  return (
    <AppRouter>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Featured Content - Most Recent IP */}
          {mostRecent ? (
            <FeaturedCard
              title={mostRecent.metadata?.name ?? `Token #${mostRecent.tokenId.toString()}`}
              genre="Audio IP"
              gradient="gradient-card-1"
              audioUrl={mostRecent.metadata?.audio_uri ? ipfsToHttp(mostRecent.metadata.audio_uri) : undefined}
              priceAmount={formatEther(mostRecent.price)}
              priceNetwork="tFIL"
            />
          ) : (
            <Link href="/store">
              <div className="cursor-pointer hover:scale-[1.02] transition-transform">
                <FeaturedCard title="Register Your First IP" genre="Get Started" gradient="gradient-card-1" />
              </div>
            </Link>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <StatCard label="Active Listings" value={listings.length.toString()} icon={FileText} />
            <StatCard label="Marketplace" value="On-Chain" icon={TrendingUp} />
          </div>

          {/* Content Lists */}
          <div className="grid grid-cols-1 gap-6">
            <ContentList
              title="Active Listings"
              items={listings.map((listing) => {
                const minutes = Math.floor((listing.metadata?.duration_seconds ?? 0) / 60);
                const seconds = (listing.metadata?.duration_seconds ?? 0) % 60;
                return {
                  id: listing.tokenId.toString(),
                  title: listing.metadata?.name ?? `Token #${listing.tokenId.toString()}`,
                  artist: `💰 ${formatEther(listing.price)} tFIL${
                    listing.metadata?.created_at
                      ? ` • ${new Date(listing.metadata.created_at).toLocaleDateString()}`
                      : ""
                  }`,
                  duration: `${minutes}:${seconds.toString().padStart(2, "0")}`,
                  audioUrl: listing.metadata?.audio_uri ? ipfsToHttp(listing.metadata.audio_uri) : undefined,
                };
              })}
              type="album"
            />
          </div>
        </div>
      </DashboardLayout>
    </AppRouter>
  );
}
