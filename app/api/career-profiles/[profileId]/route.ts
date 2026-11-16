import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ProfileNotFoundError,
  ProfileRevisionConflictError,
} from "@/lib/career-profile/repository";
import { careerProfileService } from "@/lib/career-profile/runtime";
import { CareerProfileSchema } from "@/lib/career-profile/model";

const updateRequestSchema = z.object({
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  profile: z.unknown(),
});

type RouteContext = {
  params: Promise<{ profileId: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  const { profileId } = await params;
  if (!isValidProfileId(profileId)) {
    return NextResponse.json({ error: "Career profile ID is invalid." }, { status: 400 });
  }

  try {
    if (new URL(request.url).searchParams.get("format") === "markdown") {
      const markdown = await careerProfileService.exportProfile(profileId);
      return new Response(markdown, {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": `attachment; filename="${profileId}.md"`,
        },
      });
    }
    return NextResponse.json(
      await careerProfileService.loadProfile(profileId),
    );
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        error:
          "Markdown profile editing is available in local development only. Configure a durable profile repository before enabling production edits.",
      },
      { status: 501 },
    );
  }

  const { profileId } = await params;
  if (!isValidProfileId(profileId)) {
    return NextResponse.json({ error: "Career profile ID is invalid." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    throw error;
  }

  const requestResult = updateRequestSchema.safeParse(body);
  if (!requestResult.success) {
    return NextResponse.json(
      {
        error: "Profile update request is invalid.",
        details: requestResult.error.issues,
      },
      { status: 400 },
    );
  }
  const profileResult = CareerProfileSchema.safeParse(
    requestResult.data.profile,
  );
  if (!profileResult.success) {
    return NextResponse.json(
      {
        error: "Career profile validation failed.",
        details: profileResult.error.issues,
      },
      { status: 400 },
    );
  }
  if (profileResult.data.profileId !== profileId) {
    return NextResponse.json(
      { error: "Career profile ID cannot be changed while saving." },
      { status: 400 },
    );
  }

  try {
    const savedDocument = await careerProfileService.updateProfile(
      profileId,
      profileResult.data,
      requestResult.data.expectedRevision,
    );
    return NextResponse.json(savedDocument);
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ProfileRevisionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Career profile validation failed.",
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
