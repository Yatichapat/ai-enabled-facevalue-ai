type RegionDetail = {
  average_difference: number;
  trimmed_landmark_difference?: number;
  raw_landmark_difference?: number;
  median_landmark_difference?: number;
  max_difference?: number;
  shape_difference?: number;
  landmark_count?: number;
};

export type AnalyzeResponse = {
  similarity_score?: number;
  average_difference?: number;
  mean_deviation?: number;
  alignment?: string;
  quality?: string;
  deviation_by_region?: Record<string, number>;
  region_differences?: Record<string, RegionDetail>;
  face_region_anchors?: Array<{
    region: string;
    x: number;
    y: number;
  }>;
  procedures?: Array<{
    procedure: string;
    reason: string;
    priority: string;
    estimated_cost_thb?: number;
  }>;
  package_summary?: {
    total_estimated_cost_thb?: number;
    procedure_count?: number;
  };
  analyzed_user_image?: string;
  analyzed_reference_image?: string;
  morphed_image?: string;
};

function getBackendBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
}

export async function analyzeFaces(userImage: File, referenceImage: File): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("user_image", userImage);
  formData.append("reference_image", referenceImage);

  const response = await fetch(`${getBackendBaseUrl()}/analysis/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let detail = "Analysis request failed";

    try {
      const errorData = await response.json();
      if (typeof errorData?.detail === "string") {
        detail = errorData.detail;
      }
    } catch {
      // Keep generic fallback when backend does not return JSON.
    }

    throw new Error(detail);
  }

  const data = await response.json();
  
  // Sanitize the response to remove non-serializable objects
  return sanitizeAnalysisResponse(data);
}

function sanitizeAnalysisResponse(data: unknown): AnalyzeResponse {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const obj = data as Record<string, unknown>;

  return {
    similarity_score: typeof obj.similarity_score === 'number' ? obj.similarity_score : undefined,
    average_difference: typeof obj.average_difference === 'number' ? obj.average_difference : undefined,
    mean_deviation: typeof obj.mean_deviation === 'number' ? obj.mean_deviation : undefined,
    alignment: typeof obj.alignment === 'string' ? obj.alignment : undefined,
    quality: typeof obj.quality === 'string' ? obj.quality : undefined,
    deviation_by_region: isSerializableRecord(obj.deviation_by_region) ? obj.deviation_by_region as Record<string, number> : undefined,
    region_differences: sanitizeRegionDetails(obj.region_differences),
    face_region_anchors: sanitizeFaceRegionAnchors(obj.face_region_anchors),
    procedures: Array.isArray(obj.procedures) ? (obj.procedures as Array<unknown>).filter(p => {
      return p && typeof p === 'object' && 'procedure' in p && 'reason' in p;
    }).map(p => ({
      procedure: String((p as Record<string, unknown>).procedure || ''),
      reason: String((p as Record<string, unknown>).reason || ''),
      priority: String((p as Record<string, unknown>).priority || 'normal'),
      estimated_cost_thb: typeof (p as Record<string, unknown>).estimated_cost_thb === 'number' ? (p as Record<string, unknown>).estimated_cost_thb as number : undefined,
    })) : undefined,
    package_summary: isSerializablePackageSummary(obj.package_summary) ? {
      total_estimated_cost_thb: typeof (obj.package_summary as Record<string, unknown>).total_estimated_cost_thb === 'number' ? (obj.package_summary as Record<string, unknown>).total_estimated_cost_thb as number : undefined,
      procedure_count: typeof (obj.package_summary as Record<string, unknown>).procedure_count === 'number' ? (obj.package_summary as Record<string, unknown>).procedure_count as number : undefined,
    } : undefined,
    analyzed_user_image: typeof obj.analyzed_user_image === 'string' ? obj.analyzed_user_image : undefined,
    analyzed_reference_image: typeof obj.analyzed_reference_image === 'string' ? obj.analyzed_reference_image : undefined,
    morphed_image: typeof obj.morphed_image === 'string' ? obj.morphed_image : undefined,
  };
}

function isSerializableRecord(obj: unknown): obj is Record<string, number> {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  return Object.values(record).every(v => typeof v === 'number');
}

function isSerializablePackageSummary(obj: unknown): obj is Record<string, number> {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  return Object.values(record).every(v => typeof v === 'number' || typeof v === 'undefined');
}

function sanitizeFaceRegionAnchors(value: unknown): AnalyzeResponse['face_region_anchors'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((anchor): anchor is Record<string, unknown> => {
      return Boolean(anchor) && typeof anchor === 'object';
    })
    .map((anchor) => ({
      region: typeof anchor.region === 'string' ? anchor.region : '',
      x: typeof anchor.x === 'number' ? anchor.x : 0,
      y: typeof anchor.y === 'number' ? anchor.y : 0,
    }))
    .filter((anchor) => anchor.region.length > 0);
}

function sanitizeRegionDetails(value: unknown): AnalyzeResponse['region_differences'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const details = value as Record<string, unknown>;
  const cleaned = Object.entries(details).reduce<Record<string, RegionDetail>>((acc, [region, raw]) => {
    if (!raw || typeof raw !== 'object') {
      return acc;
    }

    const row = raw as Record<string, unknown>;
    const average = row.average_difference;

    if (typeof average !== 'number') {
      return acc;
    }

    acc[region] = {
      average_difference: average,
      trimmed_landmark_difference: typeof row.trimmed_landmark_difference === 'number' ? row.trimmed_landmark_difference : undefined,
      raw_landmark_difference: typeof row.raw_landmark_difference === 'number' ? row.raw_landmark_difference : undefined,
      median_landmark_difference: typeof row.median_landmark_difference === 'number' ? row.median_landmark_difference : undefined,
      max_difference: typeof row.max_difference === 'number' ? row.max_difference : undefined,
      shape_difference: typeof row.shape_difference === 'number' ? row.shape_difference : undefined,
      landmark_count: typeof row.landmark_count === 'number' ? row.landmark_count : undefined,
    };

    return acc;
  }, {});

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}
