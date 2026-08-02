import { workPublicationError, workPublicationOk, unauthorized } from "@/app/api/_shared/work-publication-response";
import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { listWorkCasesForOwner, submitWorkAppeal } from "@/lib/server/work-governance-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return await unauthorized();
    try {
        return await workPublicationOk({ items: await listWorkCasesForOwner(user.id, (await context.params).id) });
    } catch (error) {
        return await workPublicationError(error, "获取作品申诉记录失败", "List owner work cases failed");
    }
}

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return await unauthorized();
    const body = await readJsonBody<{ versionId?: unknown; description?: unknown }>(request);
    try {
        const item = await submitWorkAppeal(user.id, (await context.params).id, body);
        return await workPublicationOk({ item }, "申诉已提交");
    } catch (error) {
        return await workPublicationError(error, "提交申诉失败", "Submit work appeal failed");
    }
}
