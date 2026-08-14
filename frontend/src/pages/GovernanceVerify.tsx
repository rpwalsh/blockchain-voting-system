/**
 * SPDX-License-Identifier: LicenseRef-Proprietary
 * Copyright (c) 2026 blockchain-voting-system.
 * Proprietary and confidential. Unauthorized use, copying, or distribution is prohibited.
 */

/**
 * The org-slug receipt verifier previously lived here as its own page,
 * separate from /verify's Merkle-proof walkthrough. Both are unified into
 * /verify now (its "look up by organization" accordion covers this flow),
 * so this route redirects rather than maintaining two verifiers.
 */

import { Navigate } from 'react-router-dom';

export default function GovernanceVerify() {
  return <Navigate to="/verify" replace />;
}
