package router

import (
	"encoding/json"
	"fmt"
	"khairul169/garage-webui/schema"
	"khairul169/garage-webui/utils"
	"net/http"
)

type Buckets struct{}

func (b *Buckets) GetAll(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserSession(r)

	body, err := utils.Garage.Fetch("/v2/ListBuckets", &utils.FetchOptions{})
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	var buckets []schema.GetBucketsRes
	if err := json.Unmarshal(body, &buckets); err != nil {
		utils.ResponseError(w, err)
		return
	}

	if user != nil && !user.IsAdmin {
		filteredBuckets := make([]schema.GetBucketsRes, 0)
		for _, bucket := range buckets {
			for _, accessibleBucket := range user.AccessibleBuckets {
				for _, alias := range bucket.GlobalAliases {
					if alias == accessibleBucket {
						filteredBuckets = append(filteredBuckets, bucket)
						goto nextBucket
					}
				}
				for _, localAlias := range bucket.LocalAliases {
					if localAlias.Alias == accessibleBucket {
						filteredBuckets = append(filteredBuckets, bucket)
						goto nextBucket
					}
				}
			}
		nextBucket:
		}
		buckets = filteredBuckets
	}

	ch := make(chan schema.Bucket, len(buckets))

	for _, bucket := range buckets {
		go func(b schema.GetBucketsRes) {
			body, err := utils.Garage.Fetch(fmt.Sprintf("/v2/GetBucketInfo?id=%s", b.ID), &utils.FetchOptions{})

			if err != nil {
				ch <- schema.Bucket{ID: b.ID, GlobalAliases: b.GlobalAliases}
				return
			}

			var data schema.Bucket
			if err := json.Unmarshal(body, &data); err != nil {
				ch <- schema.Bucket{ID: b.ID, GlobalAliases: b.GlobalAliases}
				return
			}

			data.LocalAliases = b.LocalAliases
			ch <- data
		}(bucket)
	}

	res := make([]schema.Bucket, 0, len(buckets))
	for i := 0; i < len(buckets); i++ {
		res = append(res, <-ch)
	}

	utils.ResponseSuccess(w, res)
}
