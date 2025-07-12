import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppProps } from "next/app";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../contexts/AuthContext";
import "../styles/globals.css";

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
        },
    },
});

export default function App({ Component, pageProps }: AppProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <Component {...pageProps} />
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: "#363636",
                            color: "#fff",
                        },
                        success: {
                            duration: 3000,
                            iconTheme: {
                                primary: "#4ade80",
                                secondary: "#fff",
                            },
                        },
                        error: {
                            duration: 5000,
                            iconTheme: {
                                primary: "#ef4444",
                                secondary: "#fff",
                            },
                        },
                    }}
                />
            </AuthProvider>
        </QueryClientProvider>
    );
}
