import { NextResponse } from "next/server";
import { z } from "zod";
import { ProfileNotFoundError } from "@/lib/career-profile/repository";
import { SearchPreferencesSchema } from "@/lib/search-preferences/model";
import { SearchPreferencesRevisionConflictError } from "@/lib/search-preferences/repository";
import { loadSearchStrategy, saveSearchPreferences } from "@/lib/search-intelligence/service";

const updateRequestSchema = z.object({
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  preferences: z.unknown(),
});

type RouteContext = {
  params: Promise<{ profileId: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { profileId } = await params;
  if (!isValidProfileId(profileId)) {
    return NextResponse.json(
      { error: "Search strategy profile ID is invalid." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await loadSearchStrategy(profileId));
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

export async function PUT(
  request: Request,
  { params }: RouteContext,
) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        error:
          "Markdown search-preference editing is available in local development only. Configure a durable profile repository before enabling production edits.",
      },
      { status: 501 },
    );
  }
  const { profileId } = await params;
  if (!isValidProfileId(profileId)) {
    return NextResponse.json(
      { error: "Search strategy profile ID is invalid." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }
    throw error;
  }
  const requestResult = updateRequestSchema.safeParse(body);
  if (!requestResult.success) {
    return NextResponse.json(
      {
        error: "Search preference update request is invalid.",
        details: requestResult.error.issues,
      },
      { status: 400 },
    );
  }
  const preferencesResult = SearchPreferencesSchema.safeParse(
    requestResult.data.preferences,
  );
  if (!preferencesResult.success) {
    return NextResponse.json(
      {
        error: "Search preferences are invalid.",
        details: preferencesResult.error.issues,
      },
      { status: 400 },
    );
  }
  if (preferencesResult.data.profileId !== profileId) {
    return NextResponse.json(
      { error: "Search preferences profile ID cannot be changed." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await saveSearchPreferences(
        profileId,
        preferencesResult.data,
        requestResult.data.expectedRevision,
      ),
    );
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof SearchPreferencesRevisionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Search preferences are invalid.",
          details: error.issues,
        },
        { status: 400 },
      );
    }
    throw error;
  }
}

function isValidProfileId(profileId: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(profileId);
}
