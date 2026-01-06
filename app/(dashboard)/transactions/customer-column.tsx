"use client";

import { Row } from "@signalco/ui-primitives/Row";
import { ValidationIndicator } from "./validation-indicator";

type CustomerColumnProps = {
  customerName?: string | null;
  payee?: string | null;
};

export const CustomerColumn = ({ customerName, payee }: CustomerColumnProps) => {
  const hasPayee = !!payee;
  const hasCustomer = !!customerName;

  // No payee and no customer
  if (!hasPayee && !hasCustomer) {
    return (
      <Row spacing={1}>
        <ValidationIndicator
          message="No customer information. This transaction has no payee or customer data."
          severity="warning"
        />
        <span>-</span>
      </Row>
    );
  }

  // Has payee but no customer link
  if (hasPayee && !hasCustomer) {
    return (
      <Row spacing={1}>
        <ValidationIndicator
          message="Customer not linked. This transaction has a payee but no associated customer record."
          severity="warning"
        />
        <span>{payee}</span>
      </Row>
    );
  }

  // Has customer - all good
  return <span>{customerName}</span>;
};
