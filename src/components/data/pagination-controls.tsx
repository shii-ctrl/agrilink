import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type PaginationOptions = {
  pageSize?: number;
};

export function usePagination<T>(items: T[], { pageSize = 10 }: PaginationOptions = {}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  const currentPage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, items, pageSize],
  );

  return { currentPage, pageCount, pageItems, pageSize, setPage, totalItems: items.length };
}

export function PaginationControls({
  currentPage,
  pageCount,
  pageSize,
  setPage,
  totalItems,
  itemLabel = "records",
}: {
  currentPage: number;
  pageCount: number;
  pageSize: number;
  setPage: (page: number) => void;
  totalItems: number;
  itemLabel?: string;
}) {
  if (totalItems === 0) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-sm text-muted-foreground">
      <span>
        Showing {firstItem}–{lastItem} of {totalItems} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={currentPage === 1}
          onClick={() => setPage(currentPage - 1)}
        >
          Previous
        </Button>
        <span aria-live="polite" className="min-w-20 text-center">
          Page {currentPage} of {pageCount}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={currentPage === pageCount}
          onClick={() => setPage(currentPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
