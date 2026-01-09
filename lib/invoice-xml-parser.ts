/**
 * Invoice XML Parser
 * Parses UBL (Universal Business Language) invoice XML files
 * to extract transaction data for creating new transactions
 */

export interface ParsedInvoice {
    // Invoice identification
    invoiceNumber: string;
    issueDate: Date;
    dueDate?: Date;

    // Supplier (seller) info
    supplierName: string;
    supplierVatId?: string;
    supplierAddress?: {
        street?: string;
        city?: string;
        postalCode?: string;
        country?: string;
    };

    // Customer (buyer) info
    customerName: string;
    customerVatId?: string;
    customerAddress?: {
        street?: string;
        city?: string;
        postalCode?: string;
        country?: string;
    };

    // Financial data
    currency: string;
    totalAmount: number; // Total payable amount
    taxAmount: number;
    netAmount: number; // Amount without tax

    // Line items
    lineItems: ParsedInvoiceLineItem[];

    // Payment info
    paymentReference?: string;
    payeeIban?: string;

    // Notes
    notes?: string;
}

export interface ParsedInvoiceLineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineAmount: number;
    taxPercent?: number;
}

export interface InvoiceParseResult {
    success: boolean;
    invoice?: ParsedInvoice;
    error?: string;
    rawXml?: string;
}

/**
 * Parse XML content to extract invoice data
 */
export function parseInvoiceXml(xmlContent: string): InvoiceParseResult {
    try {
        // Parse XML
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'text/xml');

        // Check for parsing errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            return {
                success: false,
                error: 'Invalid XML format',
                rawXml: xmlContent,
            };
        }

        // Try to find the Invoice element (handle different namespaces)
        let invoiceElement =
            doc.querySelector('Invoice') ||
            doc.getElementsByTagNameNS(
                'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
                'Invoice',
            )[0];

        // If wrapped in StandardBusinessDocument, find Invoice inside
        if (!invoiceElement) {
            const sbdInvoice = doc.querySelector(
                'StandardBusinessDocument Invoice',
            );
            if (sbdInvoice) {
                invoiceElement = sbdInvoice;
            }
        }

        if (!invoiceElement) {
            return {
                success: false,
                error: 'No Invoice element found in XML',
                rawXml: xmlContent,
            };
        }

        // Helper functions for extracting data
        const getText = (
            element: Element | null,
            selector: string,
        ): string | undefined => {
            if (!element) return undefined;
            const el =
                element.querySelector(selector) ||
                findElementByLocalName(element, selector);
            return el?.textContent?.trim() || undefined;
        };

        const findElementByLocalName = (
            parent: Element,
            localName: string,
        ): Element | null => {
            // Handle namespaced elements by local name
            const allElements = parent.getElementsByTagName('*');
            for (let i = 0; i < allElements.length; i++) {
                if (allElements[i].localName === localName) {
                    return allElements[i];
                }
            }
            return null;
        };

        const getNumber = (
            element: Element | null,
            selector: string,
        ): number => {
            const text = getText(element, selector);
            if (!text) return 0;
            return parseFloat(text.replace(',', '.')) || 0;
        };

        // Extract invoice identification
        const invoiceNumber =
            getText(invoiceElement, 'ID') ||
            getText(invoiceElement, 'cbc\\:ID') ||
            'Unknown';

        const issueDateStr =
            getText(invoiceElement, 'IssueDate') ||
            getText(invoiceElement, 'cbc\\:IssueDate');
        const issueDate = issueDateStr ? new Date(issueDateStr) : new Date();

        const dueDateStr =
            getText(invoiceElement, 'DueDate') ||
            getText(invoiceElement, 'cbc\\:DueDate');
        const dueDate = dueDateStr ? new Date(dueDateStr) : undefined;

        // Extract supplier info
        const supplierParty =
            invoiceElement.querySelector('AccountingSupplierParty Party') ||
            findElementByLocalName(invoiceElement, 'AccountingSupplierParty');

        const supplierName =
            getText(supplierParty, 'PartyName Name') ||
            getText(supplierParty, 'PartyLegalEntity RegistrationName') ||
            getText(supplierParty, 'cbc\\:Name') ||
            'Unknown Supplier';

        const supplierVatId =
            getText(supplierParty, 'PartyTaxScheme CompanyID') ||
            getText(supplierParty, 'PartyLegalEntity CompanyID');

        const supplierPostalAddress =
            supplierParty?.querySelector('PostalAddress');
        const supplierAddress = supplierPostalAddress
            ? {
                  street: getText(supplierPostalAddress, 'StreetName'),
                  city: getText(supplierPostalAddress, 'CityName'),
                  postalCode: getText(supplierPostalAddress, 'PostalZone'),
                  country: getText(
                      supplierPostalAddress,
                      'Country IdentificationCode',
                  ),
              }
            : undefined;

        // Extract customer info
        const customerParty =
            invoiceElement.querySelector('AccountingCustomerParty Party') ||
            findElementByLocalName(invoiceElement, 'AccountingCustomerParty');

        const customerName =
            getText(customerParty, 'PartyName Name') ||
            getText(customerParty, 'PartyLegalEntity RegistrationName') ||
            getText(customerParty, 'cbc\\:Name') ||
            'Unknown Customer';

        const customerVatId =
            getText(customerParty, 'PartyTaxScheme CompanyID') ||
            getText(customerParty, 'PartyLegalEntity CompanyID');

        const customerPostalAddress =
            customerParty?.querySelector('PostalAddress');
        const customerAddress = customerPostalAddress
            ? {
                  street: getText(customerPostalAddress, 'StreetName'),
                  city: getText(customerPostalAddress, 'CityName'),
                  postalCode: getText(customerPostalAddress, 'PostalZone'),
                  country: getText(
                      customerPostalAddress,
                      'Country IdentificationCode',
                  ),
              }
            : undefined;

        // Extract financial data
        const legalMonetaryTotal =
            invoiceElement.querySelector('LegalMonetaryTotal') ||
            findElementByLocalName(invoiceElement, 'LegalMonetaryTotal');

        const totalAmount =
            getNumber(legalMonetaryTotal, 'PayableAmount') ||
            getNumber(legalMonetaryTotal, 'TaxInclusiveAmount');

        const netAmount =
            getNumber(legalMonetaryTotal, 'TaxExclusiveAmount') ||
            getNumber(legalMonetaryTotal, 'LineExtensionAmount');

        // Extract tax
        const taxTotal =
            invoiceElement.querySelector('TaxTotal') ||
            findElementByLocalName(invoiceElement, 'TaxTotal');
        const taxAmount = getNumber(taxTotal, 'TaxAmount');

        // Extract currency
        const currencyElement = invoiceElement.querySelector(
            '[currencyID], DocumentCurrencyCode',
        );
        const currency =
            currencyElement?.getAttribute('currencyID') ||
            currencyElement?.textContent?.trim() ||
            getText(invoiceElement, 'DocumentCurrencyCode') ||
            'EUR';

        // Extract line items
        const lineItems: ParsedInvoiceLineItem[] = [];
        const invoiceLines = invoiceElement.querySelectorAll('InvoiceLine');

        invoiceLines.forEach((line, index) => {
            const lineId = getText(line, 'ID') || String(index + 1);
            const description =
                getText(line, 'Item Name') ||
                getText(line, 'Item Description') ||
                'Item';
            const quantity = getNumber(line, 'InvoicedQuantity');
            const lineAmount = getNumber(line, 'LineExtensionAmount');
            const unitPrice = getNumber(line, 'Price PriceAmount');
            const taxPercent = getNumber(
                line,
                'Item ClassifiedTaxCategory Percent',
            );

            lineItems.push({
                id: lineId,
                description,
                quantity: quantity || 1,
                unitPrice: unitPrice || lineAmount,
                lineAmount,
                taxPercent,
            });
        });

        // Extract payment info
        const paymentMeans =
            invoiceElement.querySelector('PaymentMeans') ||
            findElementByLocalName(invoiceElement, 'PaymentMeans');

        const paymentReference =
            getText(paymentMeans, 'PaymentID') ||
            getText(invoiceElement, 'PaymentMeans InstructionNote');

        const payeeIban = getText(
            paymentMeans,
            'PayeeFinancialAccount ID',
        )?.replace(/\s/g, '');

        // Extract notes
        const notes =
            getText(invoiceElement, 'Note') ||
            getText(invoiceElement, 'PaymentTerms Note');

        const invoice: ParsedInvoice = {
            invoiceNumber,
            issueDate,
            dueDate,
            supplierName,
            supplierVatId,
            supplierAddress,
            customerName,
            customerVatId,
            customerAddress,
            currency,
            totalAmount,
            taxAmount,
            netAmount,
            lineItems,
            paymentReference,
            payeeIban,
            notes,
        };

        return {
            success: true,
            invoice,
            rawXml: xmlContent,
        };
    } catch (error) {
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Unknown parsing error',
            rawXml: xmlContent,
        };
    }
}

/**
 * Parse a ZIP file containing invoice XML files
 * Returns parsed invoices along with any embedded PDF attachments
 */
export interface ZipInvoiceEntry {
    fileName: string;
    invoice: ParsedInvoice | null;
    parseError?: string;
    attachments: ZipAttachment[];
}

export interface ZipAttachment {
    fileName: string;
    mimeType: string;
    data: Blob;
}

export async function parseInvoiceZip(
    zipFile: File,
): Promise<ZipInvoiceEntry[]> {
    const JSZip = (await import('jszip')).default;
    type JSZipObject = import('jszip').JSZipObject;

    const zip = await JSZip.loadAsync(zipFile);
    const entries: ZipInvoiceEntry[] = [];

    // Process each file in the ZIP
    const filePromises: Promise<void>[] = [];

    zip.forEach((relativePath: string, file: JSZipObject) => {
        if (file.dir) return;

        const lowerPath = relativePath.toLowerCase();

        if (lowerPath.endsWith('.xml')) {
            // Parse XML invoice files
            const promise = file.async('string').then((content: string) => {
                const parseResult = parseInvoiceXml(content);

                // Check for embedded attachments in the XML
                const attachments: ZipAttachment[] = [];

                if (parseResult.success && parseResult.invoice) {
                    // Try to extract embedded base64 PDF from XML
                    const embeddedAttachments =
                        extractEmbeddedAttachments(content);
                    attachments.push(...embeddedAttachments);
                }

                entries.push({
                    fileName: relativePath,
                    invoice: parseResult.invoice || null,
                    parseError: parseResult.error,
                    attachments,
                });
            });
            filePromises.push(promise);
        } else if (
            lowerPath.endsWith('.pdf') ||
            lowerPath.endsWith('.png') ||
            lowerPath.endsWith('.jpg') ||
            lowerPath.endsWith('.jpeg')
        ) {
            // Handle standalone document files in ZIP
            const promise = file.async('blob').then((blob: Blob) => {
                const mimeType = getMimeType(relativePath);

                // Find the corresponding XML entry to attach to, or create orphan
                const baseNameMatch = relativePath.match(
                    /^(.+?)\.(pdf|png|jpg|jpeg)$/i,
                );
                const baseName = baseNameMatch
                    ? baseNameMatch[1]
                    : relativePath;

                // Try to find matching XML entry
                let found = false;
                for (const entry of entries) {
                    const entryBaseName = entry.fileName.replace(/\.xml$/i, '');
                    if (
                        entryBaseName === baseName ||
                        entry.fileName.includes(baseName)
                    ) {
                        entry.attachments.push({
                            fileName: relativePath,
                            mimeType,
                            data: blob,
                        });
                        found = true;
                        break;
                    }
                }

                // If no matching XML, create a placeholder entry
                if (!found) {
                    entries.push({
                        fileName: relativePath,
                        invoice: null,
                        attachments: [
                            {
                                fileName: relativePath,
                                mimeType,
                                data: blob,
                            },
                        ],
                    });
                }
            });
            filePromises.push(promise);
        }
    });

    await Promise.all(filePromises);

    // Post-process: try to match orphan attachments with XML entries
    const xmlEntries = entries.filter((e) => e.invoice !== null);
    const orphanEntries = entries.filter(
        (e) => e.invoice === null && e.attachments.length > 0,
    );

    // If we have exactly one XML and one orphan PDF, combine them
    if (xmlEntries.length === 1 && orphanEntries.length === 1) {
        xmlEntries[0].attachments.push(...orphanEntries[0].attachments);
        entries.splice(entries.indexOf(orphanEntries[0]), 1);
    }

    return entries.filter(
        (e) => e.invoice !== null || e.attachments.length > 0,
    );
}

/**
 * Extract embedded base64 attachments from UBL invoice XML
 */
function extractEmbeddedAttachments(xmlContent: string): ZipAttachment[] {
    const attachments: ZipAttachment[] = [];

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'text/xml');

        // Find EmbeddedDocumentBinaryObject elements
        const binaryObjects = doc.querySelectorAll(
            'EmbeddedDocumentBinaryObject',
        );

        binaryObjects.forEach((obj, index) => {
            const base64Content = obj.textContent?.trim();
            if (!base64Content) return;

            const mimeType =
                obj.getAttribute('mimeCode') || 'application/octet-stream';
            const filename =
                obj.getAttribute('filename') ||
                `attachment_${index + 1}.${getExtensionFromMime(mimeType)}`;

            try {
                // Decode base64 to binary
                const binaryString = atob(base64Content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: mimeType });

                attachments.push({
                    fileName: filename,
                    mimeType,
                    data: blob,
                });
            } catch {
                // Ignore invalid base64
            }
        });
    } catch {
        // Ignore parsing errors
    }

    return attachments;
}

function getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'pdf':
            return 'application/pdf';
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'xml':
            return 'application/xml';
        default:
            return 'application/octet-stream';
    }
}

function getExtensionFromMime(mimeType: string): string {
    switch (mimeType.toLowerCase()) {
        case 'application/pdf':
            return 'pdf';
        case 'image/png':
            return 'png';
        case 'image/jpeg':
            return 'jpg';
        default:
            return 'bin';
    }
}
