CREATE UNIQUE INDEX "Order_policyNumber_key" ON "Order"("policyNumber");

CREATE SEQUENCE "policy_number_seq" AS BIGINT START WITH 120605000 NO CYCLE;

-- Continue above all existing numbers in this series, including cancelled sales.
SELECT setval('policy_number_seq', GREATEST(
  120605000::BIGINT,
  COALESCE((SELECT MAX(split_part("policyNumber", '-', 1)::BIGINT) + 1
            FROM "Order" WHERE "policyNumber" ~ '^[0-9]{1,18}-0$'), 120605000::BIGINT)
), false);
