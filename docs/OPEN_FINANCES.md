# Open Finances - Public Financial Transparency

## Overview

The Open Finances feature allows you to publicly share selected financial metrics with complete control over what data is exposed. This is perfect for organizations that want to demonstrate financial transparency while maintaining privacy over sensitive information.

## Features

- ✅ **Selective Data Exposure**: Choose exactly which financial metrics to share publicly
- ✅ **Customizable Display**: Set custom titles, descriptions, and values for your transparency page
- ✅ **Embeddable**: Easily embed your financial transparency page on any website
- ✅ **Secure by Design**: Only explicitly enabled metrics are exposed - no data leaks
- ✅ **No Redeployment Needed**: Update displayed values anytime from the admin interface
- ✅ **Responsive Design**: Looks great on all devices

## Setup Guide

### 1. Enable Open Finances

1. Navigate to **Settings** in your Numera dashboard
2. Scroll to the **Open Finances** section
3. Toggle **Enable Open Finances** to activate the feature

### 2. Configure Your Page

#### Page Information
- **Page Title**: Set a custom title (e.g., "Our Financial Transparency")
- **Page Description**: Add context about your financial data (optional)

#### Select Metrics to Expose

Choose which financial metrics to share publicly:

- **Revenue**: Total income or revenue
- **Expenses**: Total expenses
- **Profit**: Net profit or earnings
- **Balance**: Current account balance

For each metric:
1. Toggle the switch to enable/disable
2. Enter the value you want to display (e.g., "$100,000")

**Note**: Values are displayed exactly as you enter them, so you can use any format you prefer.

### 3. Configure Embedding

- **Allow Embedding**: Enable this to allow your page to be embedded in iframes on other websites
- If disabled, the page will still be publicly accessible but cannot be embedded

## Accessing Your Public Page

### Direct URL

Your public Open Finances page is available at:

```
https://yourdomain.com/open-finances/[YOUR_USER_ID]
```

You can find your complete URL in the **Public URL** field in the settings. Share this link anywhere you want to promote financial transparency.

### Embedding on Your Website

To embed the Open Finances page on your own website:

1. Copy the **Embed Code** from the settings
2. Paste it into your website's HTML where you want the transparency page to appear

Example embed code:
```html
<iframe 
  src="https://yourdomain.com/open-finances/[YOUR_USER_ID]" 
  width="100%" 
  height="600" 
  frameborder="0" 
  style="border: 1px solid #e5e7eb; border-radius: 8px;">
</iframe>
```

**Customization Options**:
- Adjust `width` and `height` to fit your layout
- Modify `style` attributes for custom borders, shadows, etc.

## Updating Your Data

To update the displayed financial information:

1. Go to **Settings** > **Open Finances**
2. Modify the values for any enabled metric
3. Changes are **immediately reflected** on the public page
4. No redeployment or technical work required

## Security & Privacy

### What's Exposed
- Only metrics you explicitly enable are visible publicly
- Only the values you manually enter are displayed
- No automatic calculations or data aggregation from your transactions

### What's Protected
- All your transaction details remain private
- Customer information is never exposed
- Account details are not accessible
- Only your user ID is used in the public URL (no sensitive identifiers)

### Rate Limiting
The public endpoint is rate-limited to prevent abuse while ensuring legitimate access.

## Best Practices

1. **Regular Updates**: Update your metrics regularly to maintain transparency
2. **Clear Labels**: Use descriptive labels and values that your audience will understand
3. **Context Matters**: Use the page description to explain what the metrics represent
4. **Consistency**: Maintain consistent formatting for your values (e.g., always use "$" for USD)
5. **Verification**: After enabling, visit your public URL to verify everything displays correctly

## Disabling Open Finances

To disable the feature:

1. Go to **Settings** > **Open Finances**
2. Toggle **Enable Open Finances** off
3. Your public page will immediately become inaccessible
4. All your configuration is preserved if you want to re-enable later

## Troubleshooting

### Page Shows "Not Available"
- Ensure Open Finances is enabled in settings
- Verify you're using the correct user ID in the URL

### Embed Not Working
- Check that **Allow Embedding** is enabled
- Verify your website allows iframes (check CSP headers)
- Try the direct URL first to ensure the page loads

### Data Not Updating
- Changes should be instant - try refreshing the page
- Clear your browser cache if issues persist

## Support

For additional help or feature requests, please contact support or open an issue in the repository.
