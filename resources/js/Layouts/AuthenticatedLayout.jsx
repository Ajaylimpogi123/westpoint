import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
export default function AuthenticatedLayout({ children }) {
    return (
        <SidebarProvider>

            <AppSidebar variant="inset" />
            <SidebarInset  className="bg-muted">
                <SiteHeader/>

                <main >
                    <div className="absolute left-0 w-full h-[280px] bg-gradient-to-br from-green-500 via-green-400 to-green-500 z-10 rounded-md"></div>
                    {children}</main>
                <Toaster />
            </SidebarInset>
        </SidebarProvider>
    );
}
