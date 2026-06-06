package router

import "testing"

func TestIsHex(t *testing.T) {
	cases := map[string]bool{
		"abcdef0123456789": true,
		"ABCDEF":           true,
		"":                 true,
		"xyz":              false,
		"12g4":             false,
		"deadbeef":         true,
	}
	for in, want := range cases {
		if got := isHex(in); got != want {
			t.Errorf("isHex(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestRepairTypesContainsKnownVariants(t *testing.T) {
	expected := []string{"tables", "blocks", "versions", "multipartUploads", "blockRefs", "blockRc", "rebalance", "aliases", "clearResyncQueue"}
	for _, e := range expected {
		if !repairTypes[e] {
			t.Errorf("repairTypes missing %q", e)
		}
	}
	if repairTypes["scrub"] {
		t.Errorf("scrub is an object variant, must not be in the string enum map")
	}
	if repairTypes["bogus"] {
		t.Errorf("unknown repair type should not be present")
	}
}
