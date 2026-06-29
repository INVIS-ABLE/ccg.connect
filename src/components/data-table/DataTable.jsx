import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, ChevronDown, Download, Search } from 'lucide-react';

function toCsvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export the currently filtered/sorted rows to a CSV download. */
function exportCsv(table, filename) {
  const cols = table.getVisibleLeafColumns().filter((c) => c.id !== 'select' && c.id !== 'actions');
  const header = cols.map((c) => toCsvCell(c.columnDef.meta?.exportLabel ?? c.columnDef.header ?? c.id));
  const rows = table.getFilteredRowModel().rows.map((row) =>
    cols.map((c) => {
      const v = row.getValue(c.id);
      return toCsvCell(typeof v === 'object' ? JSON.stringify(v) : v);
    }),
  );
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * CCGDataTable — one reusable table for every list page (upgrade plan, step 3).
 * Pages supply `columns` (TanStack column defs) + `data`; everything else —
 * search, sort, pagination, column visibility, CSV export, row selection, bulk
 * actions and a mobile card view — is provided here in CCG's Shadcn styling.
 *
 * Props:
 *   columns, data            — TanStack column defs + rows
 *   getRowId                 — stable row id (defaults to row.id)
 *   searchPlaceholder        — global filter input placeholder
 *   enableSelection          — show selection checkboxes
 *   renderBulkActions(rows, clear) — toolbar shown when rows are selected
 *   renderCard(row)          — mobile card renderer (table is hidden < md)
 *   exportFilename           — when set, shows an Export CSV button
 *   loading, emptyMessage
 *   pageSize
 */
export function DataTable({
  columns,
  data,
  getRowId,
  searchPlaceholder = 'Search…',
  enableSelection = false,
  renderBulkActions,
  renderCard,
  exportFilename,
  loading = false,
  emptyMessage = 'Nothing to show.',
  pageSize = 10,
}) {
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState({});
  const [rowSelection, setRowSelection] = useState({});

  const selectionColumn = {
    id: 'select',
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => {
          if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
        }}
        onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]"
        checked={row.getIsSelected()}
        onChange={(e) => row.toggleSelected(e.target.checked)}
        aria-label="Select row"
      />
    ),
  };

  const table = useReactTable({
    data: data ?? [],
    columns: enableSelection ? [selectionColumn, ...columns] : columns,
    state: { sorting, globalFilter, columnVisibility, rowSelection },
    getRowId,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: enableSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows.map((r) => r.original);
  const visibleRows = table.getRowModel().rows;
  const hideableColumns = table.getAllColumns().filter((c) => c.getCanHide());

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>

        {enableSelection && selectedRows.length > 0 && renderBulkActions && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1">
            <span className="text-xs text-muted-foreground">{selectedRows.length} selected</span>
            {renderBulkActions(selectedRows, () => setRowSelection({}))}
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              Columns <ChevronDown size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hideableColumns.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.getIsVisible()}
                onCheckedChange={(v) => col.toggleVisibility(!!v)}
                className="capitalize"
              >
                {col.columnDef.meta?.exportLabel ?? col.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {exportFilename && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(table, exportFilename)}>
            <Download size={14} /> Export
          </Button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown size={13} className="opacity-50" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={table.getAllLeafColumns().length} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={table.getAllLeafColumns().length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && visibleRows.length === 0 && <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
        {!loading &&
          visibleRows.map((row) =>
            renderCard ? (
              <div key={row.id}>{renderCard(row.original)}</div>
            ) : (
              <div key={row.id} className="rounded-lg border p-3 text-sm">
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className="flex justify-between gap-3 py-0.5">
                    <span className="text-muted-foreground">
                      {cell.column.columnDef.meta?.exportLabel ?? cell.column.id}
                    </span>
                    <span className="text-right">{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                  </div>
                ))}
              </div>
            ),
          )}
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} · {table.getFilteredRowModel().rows.length} rows
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
