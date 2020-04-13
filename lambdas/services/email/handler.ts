import P from 'ts-prove'

import lambda, { useBody } from '../lib/lambdaUtils'
import airtable from '../lib/external/airtable'
import ENV from '../lib/environment'
import db from '../lib/database'
import lrx, { response$, body$ } from '../lib/lrx'
import { prove$ } from '../lib/proofs'
import { switchMap } from 'rxjs/operators'
import { sign } from '../lib/external/jwt'

export const sendEditGoupLink = lrx((req$, event) =>
  req$.pipe(
    body$,
    prove$(P.shape({ email: P.string })),
    switchMap((body) =>
      db.groups
        .get(['emails', 'id'])
        .then((grps) => grps.filter((x) => x.emails?.includes(body.email)))
        .then((grps) => (grps.length === 0 ? Promise.reject('No group with email exists') : grps))
    ),
    switchMap((grps) =>
      grps.map(
        (grp) =>
          `${event.headers.origin}/group/${grp.id}/edit?token=${sign(
            { id: grp.id },
            { expiresIn: '1h' }
          )}`
      )
    ),
    response$
  )
)

// lambda(
//   useBody(P.shape({ email: P.string }))(async function (body) {
//     return db.groups
//       .get(['emails', 'id'])
//       .then((grps) => grps.filter((x) => x.emails?.includes(body.email)))
//       .then((grps) => (grps.length === 0 ? Promise.reject('No group with email exists') : grps))
//       .then((grps) => signForGroups(grps.map((x) => x.id) as string[]))
//       .then((token) =>
//         sendEmail.editGroup(
//           body.email,
//           (this.event.headers.origin || '{NO ORIGIN}') + `/group/edit?token=${token}`
//         )
//       )
//   })
// )

export const attachEmailToGroup = lambda(
  useBody(P.shape({ email: P.string, id: P.string }))(function (body) {
    return db.groups
      .getById(body.id, ['name', 'link_facebook', 'location_name', 'emails', 'id'])
      .then((group) =>
        db.authkeys
          .create({ access_type: 'TABLE_ITEM', association: group.id as string })
          .then((auth) => ({ group, auth }))
      )
      .then(({ group, auth }) =>
        airtable.attachEmailRequest({
          confirmLink: `${this.event.headers.Host}/${ENV.STAGE}/group/addemail?id=${group.id}&email=${body.email}&token=${auth.id}`,
          email: body.email,
          group,
        })
      )
  })
)
