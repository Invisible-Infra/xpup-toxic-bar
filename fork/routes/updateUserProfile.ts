/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'

export function updateUserProfile () {
  return (req: Request, res: Response, _next: NextFunction) => {
    // Cookie profile writes are not the lab profile update. Name changes go through PUT /rest/lab/profile.
    void req
    res.status(404).json({ status: 'error', message: 'not available' })
  }
}
