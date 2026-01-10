# Tag Types

## Overview

Tags in Numera Now can be categorized into two types:

1. **General Tags** - Used for general categorization and organization of transactions
2. **Source Tags** - Used to mark the origin/source of transactions

## Source Tags

Source tags are specifically designed to track where transactions come from. This is useful for:

- Distinguishing between different transaction creation methods
- Filtering and reporting based on transaction sources
- Understanding which integrations or import methods are being used

### Common Source Tag Examples

- **Stripe** - Transactions created from Stripe payment integration
- **Manual** - Transactions created manually by users
- **eRacuni Import** - Transactions imported from eRacuni XML invoices
- **ZIP Import** - Transactions imported from ZIP file containing invoices
- **Bank Import** - Transactions imported from bank statements

## Using Tag Types

### Creating Tags

When creating or editing a tag, you can select the tag type:

1. Go to Settings > Tags
2. Create a new tag or edit an existing one
3. Select the appropriate **Tag Type**:
   - **General** - For categorization (e.g., Business, Personal, Travel)
   - **Source** - For transaction origin tracking (e.g., Stripe, Imported, Manual)

### Best Practices

- Use descriptive names for source tags (e.g., "Stripe Integration" rather than just "Stripe")
- Create source tags for each integration or import method you use
- Use general tags for business categorization and source tags for tracking origin
- Transactions can have both general and source tags applied simultaneously

## Technical Implementation

The `tagType` field is stored in the database as an enum with two possible values:
- `general` (default)
- `source`

All tags default to `general` type if not specified.
