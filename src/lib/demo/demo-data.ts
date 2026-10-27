/**
 * Development-only content for reviewing the Management interface before MySQL
 * is connected. Delete this module and its route imports when live data is ready.
 */
export const demoUsers = [
  { name: "Maria Santos", contact: "0917 555 0101", role: "Management", status: "Active" },
  { name: "Ramon Cruz", contact: "0917 555 0102", role: "Marketer", status: "Active" },
  { name: "Liza Reyes", contact: "0917 555 0103", role: "Accounting Personnel", status: "Active" },
  { name: "Juan Dela Cruz", contact: "0917 555 0104", role: "Farmer Member", status: "Active" },
  { name: "Carlo Mendoza", contact: "0917 555 0106", role: "Buyer", status: "Active" },
];

export const demoPublicProducts: Product[] = [
  {
    id: "tomato-good",
    name: "Tomato",
    cropType: "Lowland Crops",
    classification: "Good",
    pricePerKg: 78,
    quantityKg: 45,
    description: "Tomatoes supplied by farmer members, classified Good, and listed by PROCY.",
    image: tomatoImg,
  },
  {
    id: "tomato-semi",
    name: "Tomato",
    cropType: "Lowland Crops",
    classification: "Semi",
    pricePerKg: 52,
    quantityKg: 20,
    description: "Tomatoes supplied by farmer members, classified Semi, and listed by PROCY.",
    image: tomatoImg,
  },
  {
    id: "tomato-reject",
    name: "Tomato",
    cropType: "Lowland Crops",
    classification: "Reject",
    pricePerKg: 24,
    quantityKg: 10,
    description: "Tomatoes supplied by farmer members, classified Reject, and listed by PROCY.",
    image: tomatoImg,
  },
  {
    id: "cabbage-good",
    name: "Cabbage",
    cropType: "Highland Crops",
    classification: "Good",
    pricePerKg: 60,
    quantityKg: 120,
    description: "Cabbage supplied by farmer members, classified Good, and listed by PROCY.",
    image: cabbageImg,
  },
];

export const demoProductionRecords = [
  {
    farmer: "Juan Dela Cruz",
    crop: "Tomato",
    plantingDate: "Jun 10, 2026",
    expectedHarvest: "Aug 20, 2026",
    harvestedQuantity: "150 kg",
  },
  {
    farmer: "Juan Dela Cruz",
    crop: "Cabbage",
    plantingDate: "Jun 18, 2026",
    expectedHarvest: "Sep 05, 2026",
    harvestedQuantity: "120 kg",
  },
];

export const demoReceivingRecords = [
  {
    id: "REC-2026-001",
    farmer: "Juan Dela Cruz",
    product: "Tomato",
    total: "100 kg",
    good: "70 kg",
    semi: "20 kg",
    reject: "10 kg",
    recordedBy: "Ramon Cruz",
  },
  {
    id: "REC-2026-002",
    farmer: "Juan Dela Cruz",
    product: "Cabbage",
    total: "120 kg",
    good: "120 kg",
    semi: "0 kg",
    reject: "0 kg",
    recordedBy: "Ramon Cruz",
  },
];

export const demoMarketplaceListings = [
  {
    product: "Tomato",
    cropType: "Lowland Crops",
    classification: "Good",
    price: "₱78 / kg",
    quantity: "45 kg",
    availability: "Available",
  },
  {
    product: "Tomato",
    cropType: "Lowland Crops",
    classification: "Semi",
    price: "₱52 / kg",
    quantity: "20 kg",
    availability: "Available",
  },
  {
    product: "Tomato",
    cropType: "Lowland Crops",
    classification: "Reject",
    price: "₱24 / kg",
    quantity: "10 kg",
    availability: "Available",
  },
  {
    product: "Cabbage",
    cropType: "Highland Crops",
    classification: "Good",
    price: "₱60 / kg",
    quantity: "120 kg",
    availability: "Available",
  },
];

export const demoSalesRecords = [
  {
    product: "Tomato",
    classification: "Good",
    farmer: "Juan Dela Cruz",
    buyer: "Carlo Mendoza",
    quantity: "25 kg",
    price: "₱78 / kg",
    salesStatus: "Sold",
    paymentStatus: "Paid",
  },
];

export const demoTransactions = [
  {
    id: "TXN-2026-001",
    buyer: "Carlo Mendoza",
    product: "Tomato",
    classification: "Good",
    quantity: "25 kg",
    amount: "₱1,950",
    orderStatus: "Confirmed",
    paymentStatus: "Paid",
    date: "Sep 02, 2026",
  },
];

export const demoDashboardSummary = [
  { label: "Available Product Quantity", value: "195 kg", note: "Across classified listings" },
  { label: "Products Received", value: "220 kg", note: "Across 2 receiving records" },
  { label: "Pending Orders", value: "0", note: "Awaiting PROCY confirmation" },
  { label: "Sold Products", value: "25 kg", note: "Confirmed marketplace sale" },
  { label: "Paid Transactions", value: "1", note: "Recorded by Accounting" },
  { label: "Production Records", value: "2", note: "For 1 farmer member" },
];

export const demoDecisionSupport = [
  { label: "Production Summaries", value: "2 records" },
  { label: "Harvest Summaries", value: "270 kg harvested" },
  { label: "Supply Information", value: "195 kg available" },
  { label: "Buyer-Order Demand Information", value: "25 kg confirmed demand" },
  { label: "Price Information", value: "₱24–₱78 / kg" },
  { label: "Sales Information", value: "1 sale recorded" },
  { label: "Supply vs Demand Comparison", value: "Tomato supply exceeds confirmed demand" },
  { label: "Historical Trends", value: "Limited demo history" },
];

export const demoCommunityMessages = [
  {
    id: "community-2",
    author: "Ramon Cruz",
    role: "Marketer",
    time: "Today, 10:25 AM",
    message:
      "Current PROCY marketplace listings are available for buyer browsing. Classification details are shown on each listing.",
  },
  {
    id: "community-3",
    author: "Maria Santos",
    role: "Management",
    time: "Today, 1:40 PM",
    message:
      "Thank you for keeping receiving and production information up to date for accurate system monitoring.",
  },
];
import type { Product } from "@/features/marketplace/products";
import tomatoImg from "@/assets/prod-tomato.jpg";
import cabbageImg from "@/assets/prod-cabbage.jpg";
