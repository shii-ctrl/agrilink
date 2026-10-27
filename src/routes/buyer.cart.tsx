import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock3, MapPin, Minus, PackageCheck, Plus, ShoppingCart, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { BuyerLayout, BuyerPageHeader } from "@/components/workspaces/buyer-layout";
import { Button } from "@/components/ui/button";
import { useConfirmAction } from "@/components/ui/confirm-action-dialog";
import { WorkspaceLoadState } from "@/components/data/workspace-load-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceData } from "@/hooks/use-workspace-data";
import { peso } from "@/features/marketplace/products";
import { marketplaceImageFor } from "@/features/marketplace/marketplace-images";
import { getCurrentSessionUser } from "@/services/auth/auth-functions";
import {
  getBuyerCart,
  getBuyerDeliveryFee,
  placeBuyerOrder,
  setBuyerCartItem,
} from "@/services/marketplace/marketplace-server-functions";
export const Route = createFileRoute("/buyer/cart")({ component: BuyerCartPage });

type CartItem = Awaited<ReturnType<typeof getBuyerCart>>[number] & { image: string };
type CartData = { items: CartItem[]; deliveryFee: number; deliveryEnabled: boolean };
type DeliveryDetails = {
  firstName: string;
  lastName: string;
  address: string;
  apartment: string;
  barangay: string;
  postalCode: string;
  city: string;
  phone: string;
  schedule: string;
  instructions: string;
};
const emptyCartItems: CartItem[] = [];
const emptyDeliveryDetails: DeliveryDetails = {
  firstName: "",
  lastName: "",
  address: "",
  apartment: "",
  barangay: "",
  postalCode: "",
  city: "",
  phone: "",
  schedule: "",
  instructions: "",
};

function reservationCountdown(expiresAt: string, now: number) {
  const remainingSeconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function deliveryAddress(details: DeliveryDetails) {
  return [details.address, details.apartment, details.barangay, details.city, details.postalCode]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function deliveryNote(details: DeliveryDetails) {
  return [
    `Delivery recipient: ${details.firstName.trim()} ${details.lastName.trim()}`,
    `Address: ${deliveryAddress(details)}`,
    `Phone: ${details.phone.trim()}`,
    `Preferred schedule: ${details.schedule.trim()}`,
    details.instructions.trim() ? `Instructions: ${details.instructions.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function BuyerCartPage() {
  const navigate = useNavigate();
  const request = useCallback(async () => {
    const [cart, settings] = await Promise.all([getBuyerCart(), getBuyerDeliveryFee()]);
    return {
      items: cart.map((item) => ({
        ...item,
        image: item.imageUrl || marketplaceImageFor(item.name),
      })),
      deliveryFee: settings.deliveryFee,
      deliveryEnabled: settings.deliveryEnabled,
    } satisfies CartData;
  }, []);
  const { data, loading, error, reload } = useWorkspaceData(request);
  const items = data?.items ?? emptyCartItems;
  const deliveryFee = data?.deliveryFee ?? 59;
  const deliveryEnabled = data?.deliveryEnabled ?? true;
  const [contact, setContact] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [arrangementNote, setArrangementNote] = useState("");
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>(emptyDeliveryDetails);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const releasedReservationRef = useRef(false);
  const { requestConfirmation, confirmationDialog } = useConfirmAction();

  useEffect(() => {
    if (!deliveryEnabled && fulfillment === "delivery") setFulfillment("pickup");
  }, [deliveryEnabled, fulfillment]);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.pricePerKg * item.quantityKg, 0),
    [items],
  );
  const totalKg = useMemo(() => items.reduce((sum, item) => sum + item.quantityKg, 0), [items]);
  const retailSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.retailPricePerKg * item.quantityKg, 0),
    [items],
  );
  const bundleSavings = Math.max(0, retailSubtotal - total);
  const appliedDeliveryFee = fulfillment === "delivery" ? deliveryFee : 0;
  const finalTotal = total + appliedDeliveryFee;
  const earliestReservationExpiry = useMemo(
    () =>
      items.reduce<string | null>(
        (earliest, item) =>
          !earliest || new Date(item.reservationExpiresAt).getTime() < new Date(earliest).getTime()
            ? item.reservationExpiresAt
            : earliest,
        null,
      ),
    [items],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!earliestReservationExpiry || new Date(earliestReservationExpiry).getTime() > now) {
      releasedReservationRef.current = false;
      return;
    }
    if (releasedReservationRef.current) return;
    releasedReservationRef.current = true;
    void reload()
      .then(() => {
        toast("Your cart reservation expired", {
          description: "The reserved products have been returned to the marketplace.",
        });
      })
      .catch(() => undefined);
  }, [earliestReservationExpiry, now, reload]);

  useEffect(() => {
    void getCurrentSessionUser()
      .then((user) => {
        if (user?.contact) {
          setContact((currentContact) => currentContact || user.contact || "");
          setDeliveryDetails((currentDetails) => ({
            ...currentDetails,
            phone: currentDetails.phone || user.contact || "",
          }));
        }
      })
      .catch(() => undefined);
  }, []);

  async function update(id: string, quantityKg: number) {
    const item = items.find((cartItem) => cartItem.id === id);
    const maximumQuantity = (item?.availableKg ?? 0) + (item?.quantityKg ?? 0);
    const nextQuantity = Math.min(quantityKg, maximumQuantity);
    if (quantityKg > maximumQuantity) {
      toast("Only the available quantity can be ordered", {
        description: `This classified listing currently has ${maximumQuantity} kg available for your cart.`,
      });
    }
    try {
      await setBuyerCartItem({ data: { listingId: id, quantityKg: Math.max(0, nextQuantity) } });
      await reload();
    } catch (error) {
      toast.error("Could not update your cart", {
        description: error instanceof Error ? error.message : "Please refresh and try again.",
      });
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fulfillmentLabel = fulfillment === "pickup" ? "Pickup" : "Delivery";
    const orderContact = fulfillment === "delivery" ? deliveryDetails.phone.trim() : contact.trim();
    const pickupNote =
      fulfillment === "pickup"
        ? `Pickup: ${arrangementNote.trim()}`
        : `Delivery:\n${deliveryNote(deliveryDetails)}`;
    const accepted = await requestConfirmation({
      title: "Confirm your order?",
      description: `You are submitting ${items.length} product group${items.length === 1 ? "" : "s"} (${totalKg} kg) for ${peso(finalTotal)}. PROCY will review the ${fulfillmentLabel.toLocaleLowerCase()} arrangement before confirming it.`,
      confirmLabel: "Confirm order",
      cancelLabel: "Edit order",
      details: (
        <section className="rounded-2xl border border-border bg-muted/40 p-4 text-left text-sm">
          <h3 className="font-semibold">Order details</h3>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.classification} · {item.quantityKg} kg × {peso(item.pricePerKg)}
                  </p>
                </div>
                <span className="shrink-0 font-medium">
                  {peso(item.quantityKg * item.pricePerKg)}
                </span>
              </div>
            ))}
          </div>
          <dl className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Contact</dt>
              <dd className="text-right font-medium">{orderContact}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Arrangement</dt>
              <dd className="text-right font-medium">{fulfillmentLabel}</dd>
            </div>
            {fulfillment === "pickup" ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Pickup details</dt>
                <dd className="max-w-48 text-right font-medium">{arrangementNote}</dd>
              </div>
            ) : (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Recipient</dt>
                  <dd className="max-w-48 text-right font-medium">
                    {deliveryDetails.firstName} {deliveryDetails.lastName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Delivery address</dt>
                  <dd className="max-w-48 text-right font-medium">
                    {deliveryAddress(deliveryDetails)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Preferred schedule</dt>
                  <dd className="max-w-48 text-right font-medium">{deliveryDetails.schedule}</dd>
                </div>
              </>
            )}
            {fulfillment === "delivery" ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Delivery fee</dt>
                <dd className="text-right font-medium">{peso(appliedDeliveryFee)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
            <span className="font-semibold">Final total</span>
            <span className="font-display text-xl font-semibold">{peso(finalTotal)}</span>
          </div>
        </section>
      ),
    });
    if (!accepted) return;

    setPlacingOrder(true);
    try {
      const databaseOrder = await placeBuyerOrder({
        data: {
          contact: orderContact,
          pickupNote,
          fulfillment,
          items: items.map((item) => ({
            listingId: item.id,
            quantityKg: item.quantityKg,
          })),
        },
      });
      await reload();
      toast.success("Order submitted", {
        description: `${databaseOrder.orderNumber} is Pending PROCY confirmation.`,
      });
      window.location.assign("/buyer/orders");
    } catch (error) {
      toast.error("Order could not be submitted", {
        description:
          error instanceof Error ? error.message : "Please refresh the marketplace and try again.",
      });
    } finally {
      setPlacingOrder(false);
    }
  }

  return (
    <BuyerLayout>
      {confirmationDialog}
      <BuyerPageHeader
        title="My Cart"
        description="Review your selected PROCY marketplace items before submitting a buyer order."
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <WorkspaceLoadState
          loading={loading}
          error={error}
          onRetry={() => void reload()}
          label="cart"
        />
        {!loading &&
          !error &&
          (items.length === 0 ? (
            <section className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
              <ShoppingCart className="mx-auto size-8 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Your cart is empty</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Add a product from the marketplace while signed in as a Buyer.
              </p>
              <Button
                className="mt-5 rounded-full"
                onClick={() => navigate({ to: "/marketplace" })}
              >
                Browse marketplace
              </Button>
            </section>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
              <section className="space-y-4">
                <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
                  <Clock3 className="size-4 shrink-0" />
                  <span>
                    Reserved for{" "}
                    {earliestReservationExpiry
                      ? reservationCountdown(earliestReservationExpiry, now)
                      : "0:00"}
                    . Checkout before time runs out or stock returns to the marketplace.
                  </span>
                </div>
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-card"
                  >
                    <img src={item.image} alt="" className="size-20 rounded-2xl object-cover" />
                    <div className="min-w-36 flex-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.classification} · {peso(item.pricePerKg)} / kg
                      </p>
                      {item.bundlePricePerKg && item.bundleMinimumKg ? (
                        <p className="mt-1 text-xs text-primary">
                          Bundle: {peso(item.bundlePricePerKg)} / kg from {item.bundleMinimumKg} kg
                          {item.quantityKg >= item.bundleMinimumKg ? " — applied" : ""}
                        </p>
                      ) : null}
                      <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <Clock3 className="size-3" />
                        Reserved for {reservationCountdown(item.reservationExpiresAt, now)}
                      </p>
                    </div>
                    <div className="flex items-center rounded-full border border-border p-1">
                      <button
                        className="flex size-8 items-center justify-center rounded-full hover:bg-muted"
                        onClick={() => void update(item.id, item.quantityKg - 1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-14 text-center text-sm font-semibold">
                        {item.quantityKg} kg
                      </span>
                      <button
                        className="flex size-8 items-center justify-center rounded-full hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => void update(item.id, item.quantityKg + 1)}
                        disabled={item.availableKg <= 0}
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <p className="w-24 text-right font-semibold">
                      {peso(item.quantityKg * item.pricePerKg)}
                    </p>
                  </article>
                ))}
              </section>
              <section className="h-fit rounded-3xl border border-border bg-card p-6 shadow-card lg:sticky lg:top-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Order summary</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {items.length} product group{items.length === 1 ? "" : "s"} · {totalKg} kg
                    </p>
                  </div>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                    {totalKg} kg
                  </span>
                </div>

                <div className="mt-5 space-y-3 rounded-2xl border border-border bg-muted/35 p-4 text-sm">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.classification} · {item.quantityKg} kg × {peso(item.pricePerKg)}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium">
                        {peso(item.quantityKg * item.pricePerKg)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-2 border-b border-border pb-5 text-sm">
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Retail subtotal</span>
                    <span>{peso(retailSubtotal)}</span>
                  </div>
                  {bundleSavings > 0 ? (
                    <div className="flex justify-between gap-4 text-primary">
                      <span>Bundle savings</span>
                      <span>−{peso(bundleSavings)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Delivery fee</span>
                    <span>{fulfillment === "delivery" ? peso(appliedDeliveryFee) : "₱0.00"}</span>
                  </div>
                  <div className="flex items-end justify-between gap-4 pt-2">
                    <span className="font-semibold">Order total</span>
                    <span className="font-display text-3xl font-semibold">{peso(finalTotal)}</span>
                  </div>
                </div>

                <form className="mt-6 space-y-5" onSubmit={submitOrder}>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">
                      How would you like to receive it?
                    </legend>
                    <div className={deliveryEnabled ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
                      <label
                        className={`cursor-pointer rounded-2xl border p-3 transition-colors ${
                          fulfillment === "pickup"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="fulfillment"
                          value="pickup"
                          checked={fulfillment === "pickup"}
                          onChange={() => setFulfillment("pickup")}
                          className="sr-only"
                        />
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <MapPin className="size-4" /> Pickup
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Free — arrange a time with PROCY
                        </span>
                      </label>
                      {deliveryEnabled ? (
                        <label
                          className={`cursor-pointer rounded-2xl border p-3 transition-colors ${
                            fulfillment === "delivery"
                              ? "border-primary bg-primary/10"
                              : "border-border hover:bg-muted/40"
                          }`}
                        >
                          <input
                            type="radio"
                            name="fulfillment"
                            value="delivery"
                            checked={fulfillment === "delivery"}
                            onChange={() => setFulfillment("delivery")}
                            className="sr-only"
                          />
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            <Truck className="size-4" /> Delivery
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            ₱{deliveryFee.toFixed(2)} flat fee — provide an address and schedule
                          </span>
                        </label>
                      ) : null}
                    </div>
                    {!deliveryEnabled ? (
                      <p className="text-xs text-muted-foreground">
                        Delivery is temporarily unavailable. Please choose pickup.
                      </p>
                    ) : null}
                  </fieldset>
                  {fulfillment === "pickup" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="contact">Contact number</Label>
                        <Input
                          id="contact"
                          name="contact"
                          value={contact}
                          onChange={(event) => setContact(event.target.value)}
                          placeholder="0917 000 0000"
                          minLength={5}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="arrangement-note">Pickup details</Label>
                        <Input
                          id="arrangement-note"
                          name="arrangementNote"
                          value={arrangementNote}
                          onChange={(event) => setArrangementNote(event.target.value)}
                          placeholder="Preferred pickup date and time"
                          minLength={3}
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <fieldset className="space-y-5 rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
                      <legend className="sr-only">Delivery information</legend>
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <PackageCheck className="size-5" />
                        </span>
                        <div className="space-y-0.5">
                          <h3 className="font-semibold">Delivery information</h3>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Used by your assigned rider to complete the delivery.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Recipient
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="delivery-first-name">First name</Label>
                              <Input
                                id="delivery-first-name"
                                value={deliveryDetails.firstName}
                                onChange={(event) =>
                                  setDeliveryDetails((current) => ({
                                    ...current,
                                    firstName: event.target.value,
                                  }))
                                }
                                autoComplete="given-name"
                                maxLength={80}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="delivery-last-name">Last name</Label>
                              <Input
                                id="delivery-last-name"
                                value={deliveryDetails.lastName}
                                onChange={(event) =>
                                  setDeliveryDetails((current) => ({
                                    ...current,
                                    lastName: event.target.value,
                                  }))
                                }
                                autoComplete="family-name"
                                maxLength={80}
                                required
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Delivery address
                          </p>
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor="delivery-address">House number and street</Label>
                              <Input
                                id="delivery-address"
                                value={deliveryDetails.address}
                                onChange={(event) =>
                                  setDeliveryDetails((current) => ({
                                    ...current,
                                    address: event.target.value,
                                  }))
                                }
                                placeholder="House number, street, and subdivision"
                                autoComplete="street-address"
                                maxLength={220}
                                required
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label
                                  className="flex min-h-10 items-center leading-snug"
                                  htmlFor="delivery-apartment"
                                >
                                  Unit / apartment (optional)
                                </Label>
                                <Input
                                  id="delivery-apartment"
                                  value={deliveryDetails.apartment}
                                  onChange={(event) =>
                                    setDeliveryDetails((current) => ({
                                      ...current,
                                      apartment: event.target.value,
                                    }))
                                  }
                                  autoComplete="address-line2"
                                  maxLength={120}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label
                                  className="flex min-h-10 items-center leading-snug"
                                  htmlFor="delivery-barangay"
                                >
                                  Barangay
                                </Label>
                                <Input
                                  id="delivery-barangay"
                                  value={deliveryDetails.barangay}
                                  onChange={(event) =>
                                    setDeliveryDetails((current) => ({
                                      ...current,
                                      barangay: event.target.value,
                                    }))
                                  }
                                  maxLength={100}
                                  required
                                />
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label
                                  className="flex min-h-10 items-center leading-snug"
                                  htmlFor="delivery-city"
                                >
                                  City / Municipality
                                </Label>
                                <Input
                                  id="delivery-city"
                                  value={deliveryDetails.city}
                                  onChange={(event) =>
                                    setDeliveryDetails((current) => ({
                                      ...current,
                                      city: event.target.value,
                                    }))
                                  }
                                  autoComplete="address-level2"
                                  maxLength={120}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label
                                  className="flex min-h-10 items-center leading-snug"
                                  htmlFor="delivery-postal-code"
                                >
                                  Postal code
                                </Label>
                                <Input
                                  id="delivery-postal-code"
                                  value={deliveryDetails.postalCode}
                                  onChange={(event) =>
                                    setDeliveryDetails((current) => ({
                                      ...current,
                                      postalCode: event.target.value,
                                    }))
                                  }
                                  inputMode="numeric"
                                  autoComplete="postal-code"
                                  maxLength={16}
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Contact and timing
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label
                                className="flex min-h-10 items-center leading-snug"
                                htmlFor="delivery-phone"
                              >
                                Phone
                              </Label>
                              <Input
                                id="delivery-phone"
                                value={deliveryDetails.phone}
                                onChange={(event) =>
                                  setDeliveryDetails((current) => ({
                                    ...current,
                                    phone: event.target.value,
                                  }))
                                }
                                placeholder="0917 000 0000"
                                inputMode="tel"
                                autoComplete="tel"
                                minLength={5}
                                maxLength={40}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                className="flex min-h-10 items-center leading-snug"
                                htmlFor="delivery-schedule"
                              >
                                Preferred delivery date and time
                              </Label>
                              <Input
                                id="delivery-schedule"
                                value={deliveryDetails.schedule}
                                onChange={(event) =>
                                  setDeliveryDetails((current) => ({
                                    ...current,
                                    schedule: event.target.value,
                                  }))
                                }
                                placeholder="Example: Oct 28, 9:00 AM–12:00 PM"
                                minLength={3}
                                maxLength={200}
                                required
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="delivery-instructions">
                            Delivery instructions (optional)
                          </Label>
                          <Input
                            id="delivery-instructions"
                            value={deliveryDetails.instructions}
                            onChange={(event) =>
                              setDeliveryDetails((current) => ({
                                ...current,
                                instructions: event.target.value,
                              }))
                            }
                            placeholder="Landmark, gate instructions, or other helpful notes"
                            maxLength={500}
                          />
                        </div>
                      </div>
                    </fieldset>
                  )}
                  <Button type="submit" className="w-full rounded-full" disabled={placingOrder}>
                    {placingOrder ? "Submitting order…" : "Review and place order"}
                  </Button>
                </form>
                <p className="mt-3 text-xs text-muted-foreground">
                  Reserved stock is held for 10 minutes only. No online payment yet. PROCY will
                  review and confirm this order before arranging payment.
                </p>
              </section>
            </div>
          ))}
      </main>
    </BuyerLayout>
  );
}
