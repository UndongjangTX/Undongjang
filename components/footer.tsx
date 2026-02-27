import Link from "next/link";
import { t } from "@/lib/i18n";

export function Footer() {
  return (
    <footer className="bg-muted border-t mt-auto">
      <div className="container px-4 py-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-foreground hover:underline"
            >
              {t("brand")}
            </Link>
          </div>
          <div />
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-sm font-semibold text-foreground">{t("footer.explore")}</span>
              <nav className="flex flex-col gap-1 mt-1">
                <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("footer.events")}
                </Link>
                <Link href="/groups" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("footer.groups")}
                </Link>
              </nav>
            </div>
            <Link
              href="/request-spotlight"
              className="text-sm font-bold text-foreground hover:underline transition-colors"
            >
              {t("footer.requestBoost")}
            </Link>
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">{t("footer.account")}</span>
            <nav className="flex flex-col gap-1 mt-1">
              <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("nav.profile")}
              </Link>
              <Link href="/profile/groups-and-events#groups" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("nav.myGroups")}
              </Link>
              <Link href="/profile/groups-and-events#events" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("nav.myEvents")}
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
