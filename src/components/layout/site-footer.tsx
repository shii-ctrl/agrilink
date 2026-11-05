import { Link } from "@tanstack/react-router";
import { Facebook, Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { ProcyLogo } from "@/components/layout/procy-logo";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";

export function SiteFooter({ sessionSignedIn }: { sessionSignedIn?: boolean | null } = {}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (sessionSignedIn !== undefined) {
      setSignedIn(sessionSignedIn);
      return;
    }
    void getCurrentSessionUser()
      .then((account) => setSignedIn(Boolean(account)))
      .catch(() => setSignedIn(false));
  }, [sessionSignedIn]);

  return (
    <footer className="mt-16 surface-field sm:mt-24">
      <div className="grid w-full gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.9fr_1.3fr] lg:px-8">
        <div>
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
                    Register
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
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">
            Contact PROCY
          </h3>
          <ul className="mt-4 space-y-3 text-sm opacity-90">
            <li>
              <a href="tel:+639052403280" className="flex items-start gap-2.5 hover:underline">
                <Phone className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="block text-xs opacity-70">Mobile</span>
                  0905 240 3280
                </span>
              </a>
            </li>
            <li>
              <a href="tel:+63423732992" className="flex items-start gap-2.5 hover:underline">
                <Phone className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="block text-xs opacity-70">Landline</span>
                  (042) 373 2992
                </span>
              </a>
            </li>
            <li>
              <a
                href="mailto:sppaqfa@sentrongpamilihan.com"
                className="flex min-w-0 items-start gap-2.5 hover:underline"
              >
                <Mail className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 break-all">SPPAQFA@SENTRONGPAMILIHAN.COM</span>
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Facebook className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="block text-xs opacity-70">Facebook</span>
                Sentrong Pamilihan &quot;PROCY&quot;
              </span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="w-full px-4 py-5 text-xs leading-relaxed opacity-70 sm:px-6 sm:py-6 lg:px-8">
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
