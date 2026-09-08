#!/usr/bin/env python3
"""Apply customer-facing branding; preserve upstream licensing and protocol identifiers."""
from pathlib import Path
import json, re
root = Path(__file__).resolve().parent.parent / 'third_party/webapp'
p=root/'src/views/logo-view.jsx'
p.write_text("""// Modified for IM branding; upstream Apache-2.0 license retained.
import React from 'react';
export default class LogoView extends React.PureComponent {
  render() {
    return <div id="dummy-view"><div><img id="logo" alt="IM" src="img/im.svg" /><h2>IM</h2></div></div>;
  }
}
""")
p=root/'src/views/acc-support-view.jsx'
p.write_text("""// Modified for IM branding; upstream Apache-2.0 license retained.
import React from 'react';
import { FormattedMessage } from 'react-intl';
export default class AccSupportView extends React.PureComponent {
  render() {
    return <div className="scrollable-panel"><div className="panel-form-column">
      <h2>IM</h2>
      <button className="flat-button" disabled><FormattedMessage id="link_contact_us" defaultMessage="Contact Us" /></button>
      <button className="flat-button" disabled><FormattedMessage id="link_terms_of_service" defaultMessage="Terms of Service" /></button>
      <button className="flat-button" disabled><FormattedMessage id="link_privacy_policy" defaultMessage="Privacy Policy" /></button>
      <p><FormattedMessage id="im_support_pending" defaultMessage="Support and legal information are not yet configured." /></p>
    </div></div>;
  }
}
""")
p=root/'src/config.js';s=p.read_text()
s=s.replace("'TinodeWeb/'", "'IM/'")
s=re.sub(r"export const LINK_(CONTACT_US|PRIVACY_POLICY|TERMS_OF_SERVICE) = .*;",r"export const LINK_\1 = '';",s)
p.write_text(s)
p=root/'index.html';s=p.read_text().replace('TinodeWeb','IM').replace('Tinode Web','IM').replace('Tinode','IM').replace('https://web.tinode.co/','https://im.cyfljj.com/')
s=s.replace('img/logo32x32.png','img/im.svg').replace('type="image/png"','type="image/svg+xml"').replace('img/logo192.png','img/im.svg').replace('img/og-logo.jpeg','img/im.svg')
p.write_text(s)
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#3949ab"/><path d="M25 28h78v56H60L37 103V84H25z" fill="white"/><path d="M42 45v23m12 0V45l12 13 12-13v23" fill="none" stroke="#3949ab" stroke-width="6"/></svg>'
(root/'img/im.svg').write_text(svg)
p=root/'manifest.json';m=json.loads(p.read_text());m.update(name='IM',short_name='IM',description='即时通讯',icons=[{'src':'img/im.svg','sizes':'any','type':'image/svg+xml','purpose':'any'}]);p.write_text(json.dumps(m,ensure_ascii=False,indent=2))
p=root/'src/lib/utils.js';s=p.read_text().replace("'img/logo32x32' + (count > 0 ? 'a' : '') + '.png'","'img/im.svg'");p.write_text(s)

p=root/'src/lib/utils.js'
s=p.read_text().replace("+ 'Tinode';", "+ 'IM';")
p.write_text(s)
