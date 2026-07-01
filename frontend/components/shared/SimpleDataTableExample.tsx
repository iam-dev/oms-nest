import React from 'react';
import { useReactTable, flexRender, getCoreRowModel, ColumnDef } from '@tanstack/react-table';
import { SimpleDataTable } from './SimpleDataTable';

// Dummy data
type Person = { id: number; name: string; age: number; city: string };
const data: Person[] = Array.from({ length: 40 }).map((_, i) => ({
  id: i + 1,
  name: `Person ${i + 1}`,
  age: 20 + (i % 10),
  city: ['Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag'][i % 4],
}));

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age' },
  { accessorKey: 'city', header: 'City' },
];

export default function SimpleDataTableExample() {
  // TODO(react-hooks): TanStack Table's useReactTable() returns functions that the React
  // Compiler cannot safely memoize; this is a known limitation of the TanStack Table API —
  // no behavior change, compiler opts this component out of auto-memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <SimpleDataTable height="60vh" className="my-4">
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="bg-gray-100">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className="sticky top-0 z-10 bg-gray-100 px-4 py-2 border-b text-left"
                  style={{ background: 'inherit' }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} className="even:bg-gray-50">
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="px-4 py-2 border-b">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </SimpleDataTable>
  );
}
