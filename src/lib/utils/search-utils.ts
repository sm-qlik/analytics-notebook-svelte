export function extractSearchableFields(obj: any): string {
  if (obj === null || obj === undefined) return '';
  const searchableFields: string[] = [];
  const fieldsToSearch = ['qFieldDefs', 'qFieldLabels', 'qLabelExpression', 'qAlias', 'title', 'qDef', 'qTitle'];
  function flattenValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      return value.map(item => flattenValue(item)).filter(Boolean).join(' ');
    }
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([_, val]) => flattenValue(val))
        .filter(Boolean)
        .join(' ');
    }
    return '';
  }
  fieldsToSearch.forEach(field => {
    if (obj[field] !== undefined && obj[field] !== null) {
      const value = flattenValue(obj[field]);
      if (value) searchableFields.push(value);
    }
  });
  return searchableFields.join(' ');
}

export function extractLabels(obj: any, parentObj: any = null, context: any = null, qDefString: string | null = null): string[] {
  if (obj === null && parentObj === null && context === null && qDefString === null) return [];
  const labels: string[] = [];
  function extractQTitle(qTitle: any): string | null {
    if (!qTitle) return null;
    if (typeof qTitle === 'string' && qTitle.trim()) return qTitle.trim();
    if (typeof qTitle === 'object' && qTitle.qv && typeof qTitle.qv === 'string' && qTitle.qv.trim()) return qTitle.qv.trim();
    return null;
  }
  function extractQFieldLabels(qFieldLabels: any): string[] {
    if (!qFieldLabels) return [];
    const extracted: string[] = [];
    if (Array.isArray(qFieldLabels)) {
      qFieldLabels.forEach((label: any) => {
        if (typeof label === 'string' && label.trim()) {
          extracted.push(label.trim());
        } else if (typeof label === 'object' && label !== null) {
          if (label.qv && typeof label.qv === 'string') {
            extracted.push(label.qv.trim());
          } else if (label.qDef && typeof label.qDef === 'string') {
            extracted.push(label.qDef.trim());
          } else {
            const str = String(label).trim();
            if (str && str !== '[object Object]') extracted.push(str);
          }
        }
      });
    } else if (typeof qFieldLabels === 'string' && qFieldLabels.trim()) {
      extracted.push(qFieldLabels.trim());
    } else if (typeof qFieldLabels === 'object' && qFieldLabels !== null) {
      if (qFieldLabels.qv && typeof qFieldLabels.qv === 'string') {
        extracted.push(qFieldLabels.qv.trim());
      } else if (qFieldLabels.qDef && typeof qFieldLabels.qDef === 'string') {
        extracted.push(qFieldLabels.qDef.trim());
      }
    }
    return extracted;
  }
  if (typeof obj === 'object' && obj !== null) {
    if (obj.qLabel && typeof obj.qLabel === 'string' && obj.qLabel.trim()) {
      labels.push(obj.qLabel.trim());
    } else if (obj.qLabel && typeof obj.qLabel === 'object' && obj.qLabel.qv && typeof obj.qLabel.qv === 'string') {
      labels.push(obj.qLabel.qv.trim());
    }
    const qTitle = extractQTitle(obj.qTitle);
    if (qTitle) labels.push(qTitle);
    const objFieldLabels = extractQFieldLabels(obj.qFieldLabels);
    if (objFieldLabels.length > 0) labels.push(...objFieldLabels);
  }
  if (parentObj && typeof parentObj === 'object') {
    if (parentObj.qDim?.qLabel) {
      if (typeof parentObj.qDim.qLabel === 'string' && parentObj.qDim.qLabel.trim()) {
        labels.push(parentObj.qDim.qLabel.trim());
      } else if (typeof parentObj.qDim.qLabel === 'object' && parentObj.qDim.qLabel.qv && typeof parentObj.qDim.qLabel.qv === 'string') {
        labels.push(parentObj.qDim.qLabel.qv.trim());
      }
    }
    const qDimTitle = extractQTitle(parentObj.qDim?.qTitle);
    if (qDimTitle) labels.push(qDimTitle);
    const qDimFieldLabels = extractQFieldLabels(parentObj.qDim?.qFieldLabels);
    labels.push(...qDimFieldLabels);
    if (parentObj.qMeasure?.qLabel) {
      if (typeof parentObj.qMeasure.qLabel === 'string' && parentObj.qMeasure.qLabel.trim()) {
        labels.push(parentObj.qMeasure.qLabel.trim());
      } else if (typeof parentObj.qMeasure.qLabel === 'object' && parentObj.qMeasure.qLabel.qv && typeof parentObj.qMeasure.qLabel.qv === 'string') {
        labels.push(parentObj.qMeasure.qLabel.qv.trim());
      }
    }
    const qMeasureTitle = extractQTitle(parentObj.qMeasure?.qTitle);
    if (qMeasureTitle) labels.push(qMeasureTitle);
    const qMeasureFieldLabels = extractQFieldLabels(parentObj.qMeasure?.qFieldLabels);
    labels.push(...qMeasureFieldLabels);
    if (parentObj.qLabel) {
      if (typeof parentObj.qLabel === 'string' && parentObj.qLabel.trim()) {
        labels.push(parentObj.qLabel.trim());
      } else if (typeof parentObj.qLabel === 'object' && parentObj.qLabel.qv && typeof parentObj.qLabel.qv === 'string') {
        labels.push(parentObj.qLabel.qv.trim());
      }
    }
    const parentQTitle = extractQTitle(parentObj.qTitle);
    if (parentQTitle) labels.push(parentQTitle);
    const parentFieldLabels = extractQFieldLabels(parentObj.qFieldLabels);
    labels.push(...parentFieldLabels);
  }
  function getQDefString(o: any): string | null {
    if (!o) return null;
    if (typeof o === 'string') return o.trim();
    if (typeof o === 'object' && o !== null) {
      if (o.qDef) {
        if (typeof o.qDef === 'string') return o.qDef.trim();
        if (typeof o.qDef === 'object' && o.qDef.qv) return String(o.qDef.qv).trim();
        if (typeof o.qDef === 'object' && o.qDef.qDef) return String(o.qDef.qDef).trim();
      }
      if ((o as any).qv) return String((o as any).qv).trim();
    }
    return null;
  }
  const qDefValues = new Set<string>();
  if (qDefString) qDefValues.add(qDefString.trim());
  if (typeof obj === 'string') {
    qDefValues.add(obj.trim());
  } else if (obj) {
    const objQDef = getQDefString(obj);
    if (objQDef) qDefValues.add(objQDef);
  }
  if (parentObj) {
    const parentQDef = getQDefString(parentObj);
    if (parentQDef) qDefValues.add(parentQDef);
    if (parentObj.qDim) {
      const qDimQDef = getQDefString(parentObj.qDim);
      if (qDimQDef) qDefValues.add(qDimQDef);
    }
    if (parentObj.qMeasure) {
      const qMeasureQDef = getQDefString(parentObj.qMeasure);
      if (qMeasureQDef) qDefValues.add(qMeasureQDef);
    }
  }
  const filteredLabels = labels
    .map((label: any) => {
      if (typeof label !== 'string') {
        if (typeof label === 'object' && label !== null) {
          if (label.qv && typeof label.qv === 'string') return label.qv.trim();
          if (label.qDef && typeof label.qDef === 'string') return label.qDef.trim();
          const str = String(label).trim();
          if (str === '[object Object]') return '';
          return str;
        }
        const str = String(label).trim();
        if (str === '[object Object]') return '';
        return str;
      }
      return label.trim();
    })
    .filter(label => {
      if (!label) return false;
      if (label.startsWith('=')) return false;
      if (qDefValues.has(label)) return false;
      const labelWithoutEquals = label.startsWith('=') ? label.substring(1).trim() : label;
      if (qDefValues.has(labelWithoutEquals)) return false;
      for (const qDef of qDefValues) {
        const qDefWithoutEquals = qDef.startsWith('=') ? qDef.substring(1).trim() : qDef;
        if (label === qDef || label === qDefWithoutEquals || labelWithoutEquals === qDef || labelWithoutEquals === qDefWithoutEquals) {
          return false;
        }
      }
      return true;
    });
  return [...new Set(filteredLabels)];
}
