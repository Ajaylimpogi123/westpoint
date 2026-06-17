import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";

export default function SuperadminDashboard() {
  return (
    <AuthenticatedLayout
      header={
        <h2 className="text-xl font-semibold leading-tight text-gray-800">
          Superadmin Dashboard
        </h2>
      }
    >
      <div className="py-12">
        <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Superadmin Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                This is your superadmin dashboard. Content will be added here.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
