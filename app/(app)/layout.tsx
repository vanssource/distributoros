"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/format";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // =====================================================
  // REALTIME GLOBAL - Notif order baru & customer confirm
  // =====================================================
  useEffect(() => {
    // Jangan pasang subscriber kalau user belum login
    if (!user) return;

    // Minta izin notifikasi browser (sekali saja)
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    const channel = supabase
      .channel("orders-global-realtime")
      // ---------------------------------------------
      // 1. INSERT - Order baru
      // ---------------------------------------------
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const newOrder = payload.new as any;
          console.log("🔔 INSERT order:", newOrder);

          let storeName = "Unknown";
          try {
            const { data: customer } = await supabase
              .from("customers")
              .select("store_name")
              .eq("id", newOrder.customer_id)
              .single();
            storeName = customer?.store_name ?? "Unknown";
          } catch (err) {
            console.error("Gagal ambil customer:", err);
          }

          // Toast
          toast.success(`🛒 Order Baru dari ${storeName}`, {
            description: `${newOrder.order_number} - ${formatRupiah(
              Number(newOrder.total_amount),
            )}`,
            duration: 8000,
            // Kustomisasi style khusus toast ini
            className:
              "!bg-slate-900 !text-white !border-slate-800 !shadow-2xl " +
              "!rounded-xl !p-5 !min-w-[380px] !max-w-[480px]",
            classNames: {
              title: "!text-base !font-semibold !text-white",
              description: "!text-sm !text-slate-300 !mt-1",
              icon: "!text-emerald-400 !h-5 !w-5",
            },
          });

          // Browser notification
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification("🛒 Order Baru!", {
                body: `${storeName} - ${formatRupiah(Number(newOrder.total_amount))}`,
                icon: "/favicon.ico",
              });
            } catch (err) {
              console.error("Notif browser error:", err);
            }
          }

          // Sound
          try {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              await audioRef.current.play();
            }
          } catch (err) {
            console.warn("Sound autoplay diblokir:", err);
          }
        },
      )
      // ---------------------------------------------
      // 2. UPDATE - Customer confirm order
      // ---------------------------------------------
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const newOrder = payload.new as any;
          const oldOrder = payload.old as any;
          console.log("🔔 UPDATE order:", newOrder, oldOrder);

          if (newOrder.status === "confirmed" && oldOrder.status !== "confirmed") {
            let storeName = "Unknown";
            try {
              const { data: customer } = await supabase
                .from("customers")
                .select("store_name")
                .eq("id", newOrder.customer_id)
                .single();
              storeName = customer?.store_name ?? "Unknown";
            } catch (err) {
              console.error("Gagal ambil customer:", err);
            }

            toast.success(`✅ Customer ${storeName} sudah confirm!`, {
              description: `${newOrder.order_number} - ${formatRupiah(
                Number(newOrder.total_amount),
              )}`,
              duration: 8000,
            });

            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              try {
                new Notification("✅ Order Di-Confirm!", {
                  body: `${storeName} - ${newOrder.order_number}`,
                  icon: "/favicon.ico",
                });
              } catch (err) {
                console.error("Notif browser error:", err);
              }
            }

            try {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                await audioRef.current.play();
              }
            } catch (err) {
              console.warn("Sound autoplay diblokir:", err);
            }
          }
        },
      )
      .subscribe((status) => {
        console.log("🔌 Global realtime status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Audio element untuk notifikasi sound */}
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      <Sidebar />
      <div className="flex-1 overflow-auto lg:pl-0">
        <div className="lg:hidden h-14" />
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
