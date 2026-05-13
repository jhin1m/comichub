import { ReportsTable } from './_components/reports-table';

export const metadata = {
  title: 'Comment Reports',
};

export default function AdminReportsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="font-rajdhani font-bold text-2xl text-primary mb-6 uppercase tracking-wide">
        Comment Reports
      </h1>
      <ReportsTable />
    </div>
  );
}
