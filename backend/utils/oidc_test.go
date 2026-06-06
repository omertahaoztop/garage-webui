package utils

import (
	"khairul169/garage-webui/schema"
	"testing"
)

func newProviderWithMappings(mappings []schema.OIDCMapping) *OIDCProvider {
	return &OIDCProvider{cfg: schema.OIDCConfig{Mappings: mappings}}
}

func TestResolveScope_AdminViaWildcardCluster(t *testing.T) {
	p := newProviderWithMappings([]schema.OIDCMapping{
		{Group: "garage-admins", Clusters: []string{"*"}, Permissions: []string{"read", "write"}},
	})
	clusters, perms, isAdmin := p.ResolveScope([]string{"garage-admins"})
	if !isAdmin {
		t.Fatalf("wildcard cluster should grant admin")
	}
	if !contains(clusters, "*") {
		t.Errorf("expected cluster *, got %v", clusters)
	}
	if !contains(perms, "read") || !contains(perms, "write") {
		t.Errorf("expected read+write perms, got %v", perms)
	}
}

func TestResolveScope_AdminViaOwnerPerm(t *testing.T) {
	p := newProviderWithMappings([]schema.OIDCMapping{
		{Group: "ops", Clusters: []string{"prod-dc1"}, Permissions: []string{"owner"}},
	})
	_, _, isAdmin := p.ResolveScope([]string{"ops"})
	if !isAdmin {
		t.Fatalf("owner permission should grant admin")
	}
}

func TestResolveScope_NonAdminReader(t *testing.T) {
	p := newProviderWithMappings([]schema.OIDCMapping{
		{Group: "readers", Clusters: []string{"prod-dc1"}, Permissions: []string{"read"}},
	})
	clusters, perms, isAdmin := p.ResolveScope([]string{"readers"})
	if isAdmin {
		t.Errorf("reader should not be admin")
	}
	if !contains(clusters, "prod-dc1") || contains(clusters, "*") {
		t.Errorf("reader should be scoped to prod-dc1 only, got %v", clusters)
	}
	if !contains(perms, "read") || contains(perms, "owner") {
		t.Errorf("reader perms wrong: %v", perms)
	}
}

func TestResolveScope_NoMatchingGroup(t *testing.T) {
	p := newProviderWithMappings([]schema.OIDCMapping{
		{Group: "admins", Clusters: []string{"*"}, Permissions: []string{"owner"}},
	})
	clusters, perms, isAdmin := p.ResolveScope([]string{"unknown-group"})
	if isAdmin || len(clusters) != 0 || len(perms) != 0 {
		t.Errorf("unmatched group should yield empty scope, got clusters=%v perms=%v admin=%v", clusters, perms, isAdmin)
	}
}

func TestResolveScope_MultipleGroupsUnion(t *testing.T) {
	p := newProviderWithMappings([]schema.OIDCMapping{
		{Group: "a", Clusters: []string{"c1"}, Permissions: []string{"read"}},
		{Group: "b", Clusters: []string{"c2"}, Permissions: []string{"write"}},
	})
	clusters, perms, _ := p.ResolveScope([]string{"a", "b"})
	if !contains(clusters, "c1") || !contains(clusters, "c2") {
		t.Errorf("expected union of clusters, got %v", clusters)
	}
	if !contains(perms, "read") || !contains(perms, "write") {
		t.Errorf("expected union of perms, got %v", perms)
	}
}

func TestExtractGroups(t *testing.T) {
	cases := []struct {
		name   string
		claims map[string]any
		key    string
		want   []string
	}{
		{"array of any", map[string]any{"groups": []any{"a", "b"}}, "groups", []string{"a", "b"}},
		{"string scalar", map[string]any{"groups": "solo"}, "groups", []string{"solo"}},
		{"missing key", map[string]any{"email": "x@y.z"}, "groups", nil},
		{"custom claim key", map[string]any{"roles": []any{"admin"}}, "roles", []string{"admin"}},
		{"non-string items skipped", map[string]any{"groups": []any{"a", 1, "b"}}, "groups", []string{"a", "b"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := extractGroups(tc.claims, tc.key)
			if len(got) != len(tc.want) {
				t.Fatalf("len mismatch: got %v want %v", got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Errorf("index %d: got %q want %q", i, got[i], tc.want[i])
				}
			}
		})
	}
}

func contains(s []string, v string) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}
