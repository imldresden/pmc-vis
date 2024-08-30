function ndl_to_pcp(data, prop) {
    return data.nodes.map(d => {
        const pcp_polyline = { id: d.id, color: d.type === 's' ? '--pcp-primary' : '--pcp-secondary' }
        
        Object.keys(prop).forEach(p => {
            Object.keys(prop[p].props).forEach(e => {
                if (prop[p].props[e]) {
                    pcp_polyline[e] = d.details[p][e];
                }
            });
        });
        
        return pcp_polyline;
    });
}

export { ndl_to_pcp }; 