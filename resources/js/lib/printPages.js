/**
 * Splits printable line items into fixed-size pages, so a long receipt
 * prints as "Page 1 of 3" sheets that each repeat the header, instead of one
 * table the browser breaks wherever it runs out of paper.
 *
 * Always returns at least one (possibly empty) page.
 */
export function paginateItems(items = [], perPage = 12) {
    const size = Math.max(1, perPage);
    const pages = [];

    for (let start = 0; start < items.length; start += size) {
        pages.push(items.slice(start, start + size));
    }

    if (pages.length === 0) {
        pages.push([]);
    }

    return pages.map((pageItems, index) => ({
        items: pageItems,
        // Running line number of this page's first row (0-based).
        startIndex: index * size,
        pageNumber: index + 1,
        totalPages: pages.length,
        isLast: index === pages.length - 1,
        blankRows: Math.max(0, size - pageItems.length),
    }));
}

/**
 * Print rules shared by the paginated slips: one sheet per .print-page and
 * no table row split across sheets.
 */
export const PRINT_PAGE_CSS = `
    @media print {
        .print-page {
            break-after: page;
            page-break-after: always;
        }
        .print-page:last-child {
            break-after: auto;
            page-break-after: auto;
        }
        .print-page tr {
            break-inside: avoid;
            page-break-inside: avoid;
        }
    }
`;
