import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { NotificationsPopup } from "@/components/notifications-popup";
import { OnboardingModal } from "@/components/onboarding-modal";
import { OnboardingProvider } from "@/context/onboarding-context";
import { MessengerProvider } from "@/context/messenger-context";
import { MessengerWidget } from "@/components/messenger-widget";

export const metadata: Metadata = {
  title: "운동장 – 다같이 놀자 운동장에서!",
  description: "다같이 놀자 운동장에서!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased flex flex-col min-h-screen">
        <OnboardingProvider>
          <MessengerProvider>
            <Navbar />
            <OnboardingModal />
            <NotificationsPopup />
            <div className="flex-1 flex flex-col">{children}</div>
            <Footer />
            <MessengerWidget />
          </MessengerProvider>
        </OnboardingProvider>
      </body>
    </html>
  );
}
