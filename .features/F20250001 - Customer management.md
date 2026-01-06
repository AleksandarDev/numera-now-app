# Customer Management Feature

Status: Proposed

Implement feature that adds support for customer management - eg. we  want to link each transactions payee to customer.

## Specification

We should have pages for listing, creating, editing and ability to delete customers. Customers can be deleted only when there is no linked transactions attached to them.
Data that we should be able to specify for each customer: Name, PIN, VAT number, Address, contact email, contact telephone.
There should be an indicator when new customer is created but is missing some information and needs to be filled.

## Transactions

When creating new transactions we should be able to create new customers inline, and fill rest of the missing information later in customer management pages.
We should be able to pick existing customer by searching by Name or PIN and selecting the customer.

## Backwads Compatibility

Make the changes in a backward compatible way so we can migrate existing transactions from payee field to payeeCustomerId and add indicators on transactions that need editing. Once payeeCustomerId is selected, payee field needs not to be shown. Also when creating new transactions, new flow is always selecting payee customer or creating new customer.
