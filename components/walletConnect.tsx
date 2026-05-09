"use client"
import { ConnectButton } from '@rainbow-me/rainbowkit';

export const WalletConnect = () => {
    const hasWalletConnectProjectId =
        (process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "").length > 0;

    if (!hasWalletConnectProjectId) {
        return (
            <button
                type="button"
                disabled
                title="Set NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID in .env.local to enable wallet connections."
                className="text-white font-medium items-center inline-flex bg-gray-500 border border-gray-500 transition-colors focus:outline-none justify-center text-center px-4 py-2 rounded-lg text-sm opacity-60 cursor-not-allowed"
            >
                WalletConnect unavailable
            </button>
        );
    }

    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                openChainModal,
                openConnectModal,
                openAccountModal,
                authenticationStatus,
                mounted,
            }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus ||
                        authenticationStatus === 'authenticated');
                return (
                    <div
                        {...(!ready && {
                            'aria-hidden': true,
                            'style': {
                                opacity: 0,
                                pointerEvents: 'none',
                                userSelect: 'none',
                            },
                        })}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <button onClick={openConnectModal} type="button">
                                        <div className="text-white font-medium items-center inline-flex bg-blue-600 hover:bg-blue-700 border border-blue-600 transition-colors focus:outline-none justify-center text-center px-4 py-2 rounded-lg text-sm">
                                            Connect Wallet
                                        </div>
                                    </button>
                                );
                            }
                            if (chain.unsupported) {
                                return (
                                    <button onClick={openChainModal} className="text-white items-center inline-flex bg-red-600 hover:bg-red-700 border border-red-600 transition-colors focus:outline-none justify-center text-center px-4 py-2 rounded-lg text-sm">
                                        Wrong network
                                    </button>
                                );
                            }
                            return (
                                <div className="flex items-center space-x-3">
                                    <button 
                                        onClick={openAccountModal}
                                        className="bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg px-3 py-2 hover:bg-gray-700 transition-colors"
                                        title="Click to view account details and disconnect"
                                    >
                                        <span className="text-white text-sm font-medium">
                                            {account.displayName}
                                        </span>
                                    </button>
                                    <button 
                                        onClick={openChainModal}
                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        {chain.name}
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
};