CREATE TABLE `daily_cash_closings` (
  `id` varchar(36) NOT NULL,
  `business_date` varchar(10) NOT NULL,
  `opening_cash` decimal(12,2) NOT NULL,
  `gross_sales` decimal(12,2) NOT NULL,
  `pickup_collections` decimal(12,2) NOT NULL,
  `cod_collections` decimal(12,2) NOT NULL,
  `pending_cod` decimal(12,2) NOT NULL,
  `delivery_fees` decimal(12,2) NOT NULL,
  `refunds` decimal(12,2) NOT NULL,
  `farmer_payable` decimal(12,2) NOT NULL,
  `farmer_payouts` decimal(12,2) NOT NULL,
  `service_fee_income` decimal(12,2) NOT NULL,
  `ipon_contributions` decimal(12,2) NOT NULL,
  `ipon_releases` decimal(12,2) NOT NULL,
  `expected_cash` decimal(12,2) NOT NULL,
  `actual_cash` decimal(12,2) NOT NULL,
  `variance` decimal(12,2) NOT NULL,
  `notes` text,
  `closed_by_id` varchar(36) NOT NULL,
  `closed_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `daily_cash_closings_date_unique` (`business_date`),
  KEY `daily_cash_closings_closed_idx` (`closed_at`)
);
--> statement-breakpoint
CREATE TABLE `daily_cash_adjustments` (
  `id` varchar(36) NOT NULL,
  `closing_id` varchar(36) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `reason` text NOT NULL,
  `recorded_by_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `daily_cash_adjustments_closing_idx` (`closing_id`, `created_at`)
);
