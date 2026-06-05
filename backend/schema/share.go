package schema

// CreateShareRequest is the body for POST /share/create.
// All callers must be authenticated; bucket access is verified server-side
// via the same getBucketCredentials path used by /browse.
type CreateShareRequest struct {
	Bucket  string `json:"bucket"`
	Key     string `json:"key"`
	Expires int64  `json:"expires"` // seconds; clamped to [60, 7*24*3600] server-side
}

// CreateShareResult is returned by /share/create. The Url field is the
// suggested fetch URL for anonymous consumers — paste it into a chat or
// mail client. The Token field is the raw signed token so the caller can
// build a custom URL if needed.
type CreateShareResult struct {
	Token   string `json:"token"`
	Url     string `json:"url"`
	Expires int64  `json:"expires"`
}
