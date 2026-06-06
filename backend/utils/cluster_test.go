package utils

import "testing"

func newTestRegistry() *ClusterRegistry {
	r := &ClusterRegistry{byID: map[string]*Cluster{}}
	c1 := &Cluster{ID: "prod-dc1", Name: "DC1", AdminURL: "http://a:3903", AdminToken: "tok1"}
	c2 := &Cluster{ID: "prod-dc2", Name: "DC2", AdminURL: "http://b:3903"}
	r.clusters = []*Cluster{c1, c2}
	r.byID["prod-dc1"] = c1
	r.byID["prod-dc2"] = c2
	r.defaultID = "prod-dc1"
	return r
}

func TestRegistryGet(t *testing.T) {
	r := newTestRegistry()
	c, ok := r.Get("prod-dc2")
	if !ok || c.ID != "prod-dc2" {
		t.Fatalf("expected prod-dc2, got %v ok=%v", c, ok)
	}
	if _, ok := r.Get("missing"); ok {
		t.Errorf("missing cluster should not be found")
	}
}

func TestRegistryDefault(t *testing.T) {
	r := newTestRegistry()
	if d := r.Default(); d == nil || d.ID != "prod-dc1" {
		t.Fatalf("expected default prod-dc1, got %v", d)
	}
	if r.DefaultID() != "prod-dc1" {
		t.Errorf("DefaultID mismatch: %s", r.DefaultID())
	}
}

func TestRegistryPublicRedactsToken(t *testing.T) {
	r := newTestRegistry()
	pub := r.Public()
	if len(pub) != 2 {
		t.Fatalf("expected 2 public clusters, got %d", len(pub))
	}
	for _, p := range pub {
		if p.ID == "prod-dc1" {
			if !p.HasToken {
				t.Errorf("prod-dc1 should report HasToken=true")
			}
			if !p.IsDefault {
				t.Errorf("prod-dc1 should be default")
			}
		}
		if p.ID == "prod-dc2" && p.HasToken {
			t.Errorf("prod-dc2 has no token, HasToken should be false")
		}
	}
}

func TestClusterGetS3RegionFallback(t *testing.T) {
	c := &Cluster{}
	if c.GetS3Region() != "garage" {
		t.Errorf("empty region should fall back to 'garage', got %q", c.GetS3Region())
	}
	c.S3Region = "us-east-1"
	if c.GetS3Region() != "us-east-1" {
		t.Errorf("explicit region should win, got %q", c.GetS3Region())
	}
}

func TestGetClusterFromHeaderFallback(t *testing.T) {
	// Swap the package-global registry for a deterministic one, restore after.
	prev := Clusters
	Clusters = newTestRegistry()
	defer func() { Clusters = prev }()

	if c, ok := Clusters.Get("prod-dc2"); !ok || c.AdminURL != "http://b:3903" {
		t.Fatalf("header-style lookup failed: %v ok=%v", c, ok)
	}
}
