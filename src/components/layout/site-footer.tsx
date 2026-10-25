import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProcyLogo } from "@/components/layout/procy-logo";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";

export function SiteFooter() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void getCurrentSessionUser()
      .then((account) => setSignedIn(Boolean(account)))
      .catch(() => setSignedIn(false));
  }, []);

  return (
    <footer className="mt-24 surface-field">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-lime text-forest">
              <ProcyLogo className="size-8" />
            </span>
            <span className="font-display text-lg font-semibold">AgriLink</span>
          </div>
          <p className="mt-4 max-w-sm text-sm opacity-80">
            A web-based marketplace and decision support system connecting local farmer members with
            PROCY, the seller and market operator.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">Explore</h3>
          <ul className="mt-4 space-y-2 text-sm opacity-90">
            <li>
              <Link to="/marketplace" className="hover:underline">
                Marketplace
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:underline">
                About AgriLink
              </Link>
            </li>
            {signedIn === false && (
              <>
                <li>
                  <Link to="/login" className="hover:underline">
                    Login
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:underline">
                    Register as Buyer
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">PROCY</h3>
          <ul className="mt-4 space-y-2 text-sm opacity-90">
            <li>Market operator &amp; seller</li>
            <li>Quality classification</li>
            <li>Order fulfillment</li>
            <li>procy@agrilink.ph</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs opacity-70">
          © {new Date().getFullYear()} AgriLink. Products are supplied by farmer members and sold by
          PROCY.{" "}
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link to="/terms" className="hover:underline">
            Terms
          </Link>
        </p>
      </div>
    </footer>
  );
}
