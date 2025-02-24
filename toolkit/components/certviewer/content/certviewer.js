/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env mozilla/frame-script */

"use strict";

import { parse } from "./certDecoder.js";
import { pemToDER, normalizeToKebabCase } from "./utils.js";

document.addEventListener("DOMContentLoaded", async e => {
  let url = new URL(document.URL);
  let certInfo = url.searchParams.getAll("cert");
  if (certInfo.length === 0) {
    await render(false, true);
    return;
  }
  certInfo = certInfo.map(cert => decodeURIComponent(cert));
  await buildChain(certInfo);
});

export const updateSelectedItem = (() => {
  let state;
  return selectedItem => {
    let certificateSection = document.querySelector("certificate-section");
    if (selectedItem) {
      if (state !== selectedItem) {
        state = selectedItem;
        certificateSection.updateCertificateSource(selectedItem);
        certificateSection.updateSelectedTab(selectedItem);
      }
    }
    return state;
  };
})();

const createEntryItem = (labelId, info) => {
  if (
    labelId == null ||
    info == null ||
    (Array.isArray(info) && !info.length)
  ) {
    return null;
  }
  return {
    labelId,
    info,
  };
};

const addToResultUsing = (callback, certItems, sectionId, Critical) => {
  let items = callback();
  if (items.length) {
    certItems.push({
      sectionId,
      sectionItems: items,
      Critical,
    });
  }
};

const getElementByPathOrFalse = (obj, pathString) => {
  let pathArray = pathString.split(".");
  let result = obj;
  for (let entry of pathArray) {
    result = result[entry];
    if (result == null) {
      return false;
    }
  }
  return result ? result : false;
};

export const adjustCertInformation = cert => {
  let certItems = [];
  let tabName = cert.subject ? cert.subject.cn || "" : "";

  if (!cert) {
    return {
      certItems,
      tabName,
    };
  }

  addToResultUsing(
    () => {
      let items = [];
      if (cert.subject && cert.subject.entries) {
        items = cert.subject.entries
          .map(entry =>
            createEntryItem(normalizeToKebabCase(entry[0]), entry[1])
          )
          .filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "subject-name",
    false
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.issuer && cert.issuer.entries) {
        items = cert.issuer.entries
          .map(entry =>
            createEntryItem(normalizeToKebabCase(entry[0]), entry[1])
          )
          .filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "issuer-name",
    false
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.notBefore && cert.notAfter) {
        items = [
          createEntryItem("not-before", {
            local: cert.notBefore,
            utc: cert.notBeforeUTC,
          }),
          createEntryItem("not-after", {
            local: cert.notAfter,
            utc: cert.notAfterUTC,
          }),
        ].filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "validity",
    false
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext && cert.ext.san && cert.ext.san.altNames) {
        items = cert.ext.san.altNames
          .map(entry =>
            createEntryItem(normalizeToKebabCase(entry[0]), entry[1])
          )
          .filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "subject-alt-names",
    getElementByPathOrFalse(cert, "ext.san.critical")
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.subjectPublicKeyInfo) {
        items = [
          createEntryItem("algorithm", cert.subjectPublicKeyInfo.kty),
          createEntryItem("key-size", cert.subjectPublicKeyInfo.keysize),
          createEntryItem("curve", cert.subjectPublicKeyInfo.crv),
          createEntryItem("public-value", cert.subjectPublicKeyInfo.xy),
          createEntryItem("exponent", cert.subjectPublicKeyInfo.e),
          createEntryItem("modulus", cert.subjectPublicKeyInfo.n),
        ].filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "public-key-info",
    false
  );

  addToResultUsing(
    () => {
      let items = [
        createEntryItem("serial-number", cert.serialNumber),
        createEntryItem(
          "signature-algorithm",
          cert.signature ? cert.signature.name : null
        ),
        createEntryItem("version", cert.version),
        createEntryItem("download", cert.files ? cert.files.pem : null),
      ].filter(elem => elem != null);
      return items;
    },
    certItems,
    "miscellaneous",
    false
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.fingerprint) {
        items = [
          createEntryItem("sha-256", cert.fingerprint.sha256),
          createEntryItem("sha-1", cert.fingerprint.sha1),
        ].filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "fingerprints",
    false
  );

  if (!cert.ext) {
    return {
      certItems,
      tabName,
    };
  }

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext.basicConstraints) {
        items = [
          createEntryItem(
            "certificate-authority",
            cert.ext.basicConstraints.cA
          ),
        ].filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "basic-constraints",
    getElementByPathOrFalse(cert, "ext.basicConstraints.critical")
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext.keyUsages) {
        items = [
          createEntryItem("purposes", cert.ext.keyUsages.purposes),
        ].filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "key-usages",
    getElementByPathOrFalse(cert, "ext.keyUsages.critical")
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext.eKeyUsages) {
        items = [
          createEntryItem("purposes", cert.ext.eKeyUsages.purposes),
        ].filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "extended-key-usages",
    getElementByPathOrFalse(cert, "ext.eKeyUsages.critical")
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext.ocspStaple) {
        items = [
          createEntryItem("required", cert.ext.ocspStaple.critical),
        ].filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "ocsp-stapling",
    getElementByPathOrFalse(cert, "ext.ocspStaple.critical")
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext.sKID) {
        items = [createEntryItem("key-id", cert.ext.sKID.id)].filter(
          elem => elem != null
        );
      }
      return items;
    },
    certItems,
    "subject-key-id",
    getElementByPathOrFalse(cert, "ext.sKID.critical")
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext.aKID) {
        items = [createEntryItem("key-id", cert.ext.aKID.id)].filter(
          elem => elem != null
        );
      }
      return items;
    },
    certItems,
    "authority-key-id",
    getElementByPathOrFalse(cert, "ext.aKID.critical")
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext.crlPoints && cert.ext.crlPoints.points) {
        items = cert.ext.crlPoints.points
          .map(entry => {
            let label = "distribution-point";
            return createEntryItem(label, entry);
          })
          .filter(elem => elem != null);
      }
      return items;
    },
    certItems,
    "crl-endpoints",
    getElementByPathOrFalse(cert, "ext.crlPoints.critical")
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext.aia && cert.ext.aia.descriptions) {
        cert.ext.aia.descriptions.forEach(entry => {
          items.push(createEntryItem("location", entry.location));
          items.push(createEntryItem("method", entry.method));
        });
      }
      return items.filter(elem => elem != null);
    },
    certItems,
    "authority-info-aia",
    getElementByPathOrFalse(cert, "ext.aia.critical")
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext.cp && cert.ext.cp.policies) {
        cert.ext.cp.policies.forEach(entry => {
          if (entry.name && entry.id) {
            items.push(
              createEntryItem("policy", entry.name + " ( " + entry.id + " )")
            );
          }
          items.push(createEntryItem("value", entry.value));
          if (entry.qualifiers) {
            entry.qualifiers.forEach(qualifier => {
              if (qualifier.name && qualifier.id) {
                items.push(
                  createEntryItem(
                    "qualifier",
                    qualifier.name + " ( " + qualifier.id + " )"
                  )
                );
              }
              items.push(createEntryItem("value", qualifier.value));
            });
          }
        });
      }
      return items.filter(elem => elem != null);
    },
    certItems,
    "certificate-policies",
    getElementByPathOrFalse(cert, "ext.cp.critical")
  );

  addToResultUsing(
    () => {
      let items = [];
      if (cert.ext.scts && cert.ext.scts.timestamps) {
        cert.ext.scts.timestamps.forEach(entry => {
          let timestamps = {};
          for (let key of Object.keys(entry)) {
            if (key.includes("timestamp")) {
              timestamps[key.includes("UTC") ? "utc" : "local"] = entry[key];
            } else {
              items.push(
                createEntryItem(normalizeToKebabCase(key), entry[key])
              );
            }
          }
          items.push(createEntryItem("timestamp", timestamps));
        });
      }
      return items.filter(elem => elem != null);
    },
    certItems,
    "embedded-scts",
    getElementByPathOrFalse(cert, "ext.scts.critical")
  );

  return {
    certItems,
    tabName,
  };
};

const render = async (certs, error) => {
  await customElements.whenDefined("certificate-section");
  const CertificateSection = customElements.get("certificate-section");
  document.querySelector("body").append(new CertificateSection(certs, error));
  return Promise.resolve();
};

const buildChain = async chain => {
  await Promise.all(
    chain
      .map(cert => {
        try {
          return pemToDER(cert);
        } catch (err) {
          return Promise.reject(err);
        }
      })
      .map(cert => {
        try {
          return parse(cert);
        } catch (err) {
          return Promise.reject(err);
        }
      })
  )
    .then(certs => {
      if (certs.length === 0) {
        return Promise.reject();
      }
      let adjustedCerts = certs.map(cert => adjustCertInformation(cert));
      return render(adjustedCerts, false);
    })
    .catch(err => {
      render(null, true);
    });
};
