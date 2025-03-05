import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card";

export default function SettingsPage() {
    return (
        <div className="mx-auto  -mt-12 lg:-mt-24 w-full max-w-screen-2xl pb-10">
            <Card>
                <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle>
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