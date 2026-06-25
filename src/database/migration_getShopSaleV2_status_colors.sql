-- ============================================================
-- Migration: add status colors (bg_color / color) to getShopSaleV2
-- Target row: public.sql_queries WHERE path = '/getShopSaleV2'
-- Adds bg_color & color to status, paymentStatus and deliveryPaymentStatus
-- so the sale detail view can render the status pills with their own colors
-- (matching the sales list / listShopSaleV2).
-- Run once against the live database.
-- ============================================================

UPDATE public.sql_queries
SET consulta_sql = 'select json_build_object(
    ''id'', ss.id,
    ''nameClient'', ss.name_client,
    ''nitClient'', ss.nit_client,
    ''nota'', ss.nota,
    ''total'', ss.total,
    ''totalDiscount'', ss.total_discount,
    ''delivery'', ss.delivery,
    ''paidAmount'', ss.paid_amount,
    ''pendingAmount'', ss.pending_amount,
    ''deliveryPaidAmount'', ss.delivery_paid_amount,
    ''deliveryPendingAmount'', ss.delivery_pending_amount,
    ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
    ''creationDate'', ss.creation_date,
    ''status'', json_build_object(
        ''identifier'', s.name,
        ''id'', s.id,
        ''bg_color'', s.bg_color,
        ''color'', s.color
    ),
    ''paymentStatus'', json_build_object(
        ''identifier'', pst.name,
        ''id'', pst.id,
        ''bg_color'', pst.bg_color,
        ''color'', pst.color
    ),
    ''deliveryPaymentStatus'', json_build_object(
        ''identifier'', dpst.name,
        ''id'', dpst.id,
        ''bg_color'', dpst.bg_color,
        ''color'', dpst.color
    ),
    ''paymentType'', json_build_object(
        ''identifier'', pt."name",
        ''id'', pt.id
    ),
    ''deliveryPaymentType'', json_build_object(
        ''identifier'', dpt."name",
        ''id'', dpt.id
    ),
    ''creatorUser'', json_build_object(
        ''name'', u.username,
        ''email'', u.email,
        ''id'', u.id
    ),
    ''establishment'', json_build_object(
        ''identifier'', e."name",
        ''name'', e."name",
        ''id'', e.id,
        ''address'', e.address
    ),
    ''establecimiento'', json_build_object(
        ''identifier'', e."name",
        ''name'', e."name",
        ''id'', e.id,
        ''address'', e.address
    ),
    ''itemsList'', (
	    SELECT json_agg(
		    json_build_object(
		    	''id'', sse.id,
		    	''quantity'', sse.quantity,
		    	''discount'', sse.discount,
		    	''price'', sse.price,
		    	''subtotal'', sse.subtotal,
		    	''totalDiscount'', sse.total_discount,
		    	''total'', sse.total,
		    	''measure'', json_build_object(
		    		''id'', m2.id,
		    		''identifier'', m2.name
		    	),
		    	''productForSale'', json_build_object(
			        ''id'', pfs.id,
			        ''creationDate'', pfs.creation_date,
				    ''updatedDate'', pfs.updated_date,
			        ''price'', pfs.price,
			        ''finishedProduct'', json_build_object(
			            ''id'', fp.id,
			            ''name'', fp.name,
			            ''identifier'', fp.name,
			            ''photo'', fp.photo,
			            ''description'', fp.description,
			            ''measure'', json_build_object(
			                ''identifier'', ub.name,
			                ''type'', ub."type"
			            )
			        )
				)
		    )
		)
		from shop_sale_element sse
		left join product_for_sale pfs on pfs.id = sse.product_for_sale_id
		LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
		LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
		left join measure m2 on sse.measure_id = m2.id
		WHERE sse.shop_sale_id = ss.id
	)
) as json_result
from shop_sale ss
left join status s on ss.status_id = s.id
left join status pst on ss.payment_status_id = pst.id
left join status dpst on ss.delivery_payment_status_id = dpst.id
left join payment_type pt on ss.payment_type_id = pt.id
left join payment_type dpt on ss.delivery_payment_type_id = dpt.id
left join "user" u on ss.creator_user_id = u.id
left join establishment e on ss.establishment_id = e.id'
WHERE "path" = '/getShopSaleV2';
