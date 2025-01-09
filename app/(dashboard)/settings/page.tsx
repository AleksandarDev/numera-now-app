import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
    return (
        <div className="mx-auto  -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
            <Card className="border-none drop-shadow-sm">
                <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle className="line-clamp-1 text-xl">
                        Settings
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="py-12 text-center opacity-60">No settings</p>
                </CardContent>
            </Card>
        </div>
    );
}