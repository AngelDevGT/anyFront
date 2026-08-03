INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getEstablishment','/getEstablishment','SELECT json_build_object(
    ''id'', e.id,
    ''name'', e."name",
    ''address'', e.address ,
    ''description'', e.description,
    ''receivePendingOrdersEnabled'', e.receive_pending_orders_enabled,
    ''establishmentTypeId'', e.establishment_type_id,
    ''status'', json_build_object(
    	''id'', s.id,
        ''name'', s.name,
        ''identifier'', s.name,
        ''status'', s.status
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
    	''name'', u.username,
    	''email'', u.email
    ),
    ''creationDate'', e.creation_date,
    ''updatedDate'', coalesce(e.updated_date, e.creation_date)
) as json_result
FROM establishment e
LEFT JOIN status s ON s.id = e.status_id
left join "user" u on u.id = e.creator_user_id','establishment','POST'),
	 ('getProviderById','/getProvider','SELECT json_build_object(
        ''id'', p.id,
        ''name'', p.name,
        ''description'', p.description,
        ''email'', p.email,
        ''phone'', p.phone,
        ''company'', p.company,
        ''creationDate'', p.creation_date,
        ''updatedDate'', p.updated_date,
        ''status'', json_build_object(
        	''id'', s.id,
            ''identifier'', s.name,
            ''status'', s.status
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    ) as json_result
FROM provider p
LEFT JOIN status s ON s.id = p.status_id
LEFT JOIN "user" u ON u.id = p.creator_user_id','provider','POST'),
	 ('getAllProvidersByFilter','/retrieveProviders','SELECT json_agg(
    json_build_object(
        ''id'', p.id,
        ''name'', p.name,
        ''description'', p.description,
        ''email'', p.email,
        ''phone'', p.phone,
        ''company'', p.company,
        ''creationDate'', p.creation_date,
        ''updatedDate'', p.updated_date,
        ''status'', json_build_object(
        	''id'', s.id,
            ''identifier'', s.name,
            ''status'', s.status
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
) as json_result
FROM provider p
LEFT JOIN status s ON s.id = p.status_id
LEFT JOIN "user" u ON u.id = p.creator_user_id','provider','POST'),
	 ('retrieveEstablishments','/retrieveEstablishments','with establishment_rcds as (
	select * from establishment e1 
	order by e1.creation_date asc
)
SELECT json_agg(json_build_object(
    ''id'', e.id,
    ''name'', e."name",
    ''address'', e.address ,
    ''description'', e.description,
    ''receivePendingOrdersEnabled'', e.receive_pending_orders_enabled,
    ''establishmentTypeId'', e.establishment_type_id,
    ''status'', json_build_object(
    	''id'', s.id,
        ''name'', s.name,
        ''status'', s.status
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
    	''name'', u.username,
    	''email'', u.email
    )
)) as json_result
FROM establishment_rcds e
LEFT JOIN status s ON s.id = e.status_id
left join "user" u on u.id = e.creator_user_id ','establishment','POST'),
	 ('getRoles','/getRoles','SELECT json_agg(
	json_build_object(
		''id'', id,
		''identifier'', name,
		''status'', status,
		''paths'', paths::jsonb
	)
) as json_result
from "role" r ','role','POST'),
	 ('getMeasure','/getMeasure','SELECT json_agg(
    json_build_object(
        ''id'', m.id,
        ''identifier'', m.name,
        ''name'', m.name,
        ''status'', m.status,
        ''unit_base_id'', m.unit_base_id,
        ''unitBase'', json_build_object(
            ''quantity'', m.unit_base_quantity,
            ''name'', ub.name,
            ''type'', ub."type"
        )
    )
) as json_result
FROM measure m
LEFT JOIN unit_base ub ON m.unit_base_id = ub.id','measure','POST'),
	 ('registerShop','/registerShop','call register_shop_sale_with_elements($1,$2,$3::uuid)','shop_sale','PATCH'),
	 ('getStatus','/getStatus','SELECT json_agg(
	json_build_object(
		''id'', id,
		''identifier'', "name" ,
		''status'', status,
		''name'', "name",
		''text'', id::text
	)
) as json_result
from status s','status','POST'),
	 ('retrieveUsers','/retrieveUsers','SELECT jsonb_agg(
    jsonb_build_object(
        ''id'', u.id,
        ''name'', u.username,
        ''email'', u.email,
        ''phone'', u.phone,
        ''role'', jsonb_build_object(
            ''id'', r.id,
            ''identifier'', r.name,
            ''status'', r.status
        ),
        ''status'', jsonb_build_object(
            ''id'', s.id,
            ''identifier'', s.name,
            ''type'', s."type"
        )
    )
) as json_result
from "user" u 
left join "role" r on u.role_id = r.id
left join "status" s on u.status_id = s.id','user','POST'),
	 ('updateProductForSaleStoreOrder','/updateProductForSaleStoreOrder','call update_product_for_sale_order_with_elements($1::uuid, $2, $3)','product_for_sale_store_order','PATCH');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getUnitBase','/getUnitBase','SELECT json_agg(
	json_build_object(
		''id'', id,
		''identifier'', "name" ,
		''type'', "type" ,
		''name'', "name"
	)
) as json_result
from unit_base u','unit_base','POST'),
	 ('getRawMaterial','/getRawMaterial','select json_build_object(
    ''id'', rm.id,
    ''rm_id'', rm.id,
    ''name'', rm.name,
    ''photo'', rm.photo,
    ''description'', rm.description,
    ''creationDate'', rm.creation_date,
    ''updatedDate'', coalesce(rm.updated_date, rm.creation_date),
    ''measure'', json_build_object(
    	''id'', ub.id,
        ''identifier'', ub.name,
        ''type'', ub."type"
    ),
    ''status'', json_build_object(
    	''id'', s.id,
        ''identifier'', s.name,
        ''type'', s."type"
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM raw_material rm
LEFT JOIN unit_base ub ON ub.id = rm.unit_base_id
LEFT JOIN status s ON s.id = rm.status_id
LEFT JOIN "user" u ON u.id = rm.creator_user_id','raw_material','POST'),
	 ('getPaymentTypes','/getPaymentTypes','SELECT json_agg(
	json_build_object(
		''id'', id,
		''identifier'', "name" ,
		''status'', status,
		''name'', "name"
	)
) as json_result
from payment_type p','payment_type','POST'),
	 ('retrievePackagingMaterialInventory','/retrievePackagingMaterialInventory','SELECT json_build_object(
    ''id'', i.id,
    ''name'', i."name",
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''updatedDate'', i.updated_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''rawMaterialBase'', json_build_object(
                    ''id'', rm.id,
                    ''name'', rm.name,
                    ''photo'', rm.photo,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub.name
                    )
                )
            )
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON ie.status_id = sie.id
        LEFT JOIN measure m ON ie.measure_id = m.id
        LEFT JOIN unit_base ub ON m.unit_base_id = ub.id
        JOIN raw_material rm ON ie.element_fk = rm.id
        LEFT JOIN unit_base ub2 ON ub2.id = rm.unit_base_id
        LEFT JOIN status srm ON srm.id = rm.status_id
        WHERE ie.element_type = ''packaging_material''
          AND ie.inventory_id = i.id
          AND EXISTS (
              SELECT 1 FROM raw_material_by_provider rmbp
              WHERE rmbp.raw_material_base_id = rm.id
                AND rmbp.raw_material_by_provider_type_id = 2
                AND rmbp.status_id <> 35
          )
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''packaging_material''','inventory','POST'),
	 ('retrieveRawMaterial','/retrieveRawMaterial','SELECT json_agg(
    json_build_object(
        ''id'', rm.id,
        ''rm_id'', rm.id,
        ''name'', rm.name,
        ''photo'', rm.photo,
	    ''description'', rm.description,
	    ''creationDate'', rm.creation_date,
	    ''updatedDate'', coalesce(rm.updated_date, rm.creation_date),
        ''measure'', json_build_object(
        	''id'', ub.id,
            ''identifier'', ub.name,
            ''type'', ub."type"
        ),
        ''status'', json_build_object(
        	''id'', s.id,
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
) as json_result
FROM raw_material rm
LEFT JOIN unit_base ub ON ub.id = rm.unit_base_id
LEFT JOIN status s ON s.id = rm.status_id
LEFT JOIN "user" u ON u.id = rm.creator_user_id','raw_material','POST'),
	 ('UpdateShopHistory','/UpdateShopHistory','update shop_sale
set name_client = $1, nit_client = $2, nota = $3, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $4','shop_sale','PATCH'),
	 ('retrieveRawMaterialOrder','/retrieveRawMaterialOrder','SELECT json_agg(
    json_build_object(
        ''id'', rmo.id,
        ''paidAmount'', rmo.paid_amount,
        ''finalAmount'', rmo.final_amount,
        ''pendingAmount'', rmo.pending_amount,
        ''status'', json_build_object(
            ''identifier'', s.name,
            ''id'', s.id
        ),
        ''paymentStatus'', json_build_object(
            ''identifier'', s2.name,
            ''id'', s2.id
        ),
        ''paymentType'', json_build_object(
            ''identifier'', pt.name,
            ''id'', pt.id
        ),
        ''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email,
            ''id'', u.id
        ),
        ''provider'', json_build_object(
            ''name'', p.name,
            ''id'', p.id
        ),
        ''rawMaterialOrderElements'', (
            SELECT json_agg(
                json_build_object(
                    ''id'', rmoe.id,
                    ''price'', rmoe.price,
                    ''discount'', rmoe.discount,
                    ''quantity'', rmoe.quantity,
                    ''subtotalPrice'', rmoe.subtotal_price,
                    ''totalDiscount'', rmoe.total_discount,
                    ''totalPrice'', rmoe.total_price,
                    ''rawMaterialByProvider'', json_build_object(
                        ''rawMaterialBase'', json_build_object(
                            ''name'', rm.name,
                            ''id'', rm.id
                        ),
                        ''provider'', json_build_object(
                            ''name'', p.name,
                            ''id'', p.id,
                            ''email'', p.email
                        )
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', m.name,
                        ''id'', m.id,
                        ''unitBase'', json_build_object(
                            ''quantity'', m.unit_base_quantity,
                            ''id'', m.unit_base_id
                        )
                    )
                )
            )
            FROM raw_material_order_element rmoe
            LEFT JOIN measure m ON m.id = rmoe.measure_id
            LEFT JOIN raw_material_by_provider rmbp ON rmbp.id = rmoe.raw_material_by_provider_id
            LEFT JOIN raw_material rm ON rm.id = rmbp.raw_material_base_id
            LEFT JOIN provider p ON rmbp.provider_id = p.id
            WHERE rmoe.raw_material_order_id = rmo.id
        ),
        ''rawMaterialOrderPayments'', (
            SELECT json_agg(
                json_build_object(
                    ''date'', rmop.date,
                    ''amount'', rmop.amount,
                    ''paymentType'', json_build_object(
                        ''name'', pt2.name,
                        ''id'', pt2.id
                    )
                )
            )
            FROM raw_material_order_payment rmop
            LEFT JOIN payment_type pt2 ON rmop.payment_type_id = pt2.id
            WHERE rmop.raw_material_order_id = rmo.id
        )
    )
)
FROM raw_material_order rmo
LEFT JOIN status s ON s.id = rmo.status_id
LEFT JOIN status s2 ON s2.id = rmo.payment_status_id
LEFT JOIN payment_type pt ON pt.id = rmo.payment_type_id
LEFT JOIN "user" u ON u.id = rmo.creator_user_id
LEFT JOIN provider p ON p.id = rmo.provider_id','raw_material_order','POST'),
	 ('retrieveFinishedProduct','/retrieveFinishedProduct','SELECT json_agg(
    json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''description'', fp.description,
        ''photo'', fp.photo,
        ''creationDate'', fp.creation_date,
        ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
        ''finishedProductTypeId'', fp.finished_product_type_id,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        ),
        ''status'', json_build_object(
        	''id'', s.id,
        	''identifier'', s.name,
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
) as json_result
FROM finished_product fp
LEFT JOIN unit_base ub ON ub.id = fp.unit_base_id
LEFT JOIN status s ON s.id = fp.status_id
LEFT JOIN "user" u ON u.id = fp.creator_user_id','finished_product','POST'),
	 ('cancelShopHistory','/cancelShopHistory','call cancel_shop_sale($1::uuid, $2::uuid)','shop_sale','PATCH'),
	 ('getFinishedProduct','/getFinishedProduct','SELECT json_build_object(
    ''id'', fp.id,
    ''name'', fp.name,
    ''description'', fp.description,
    ''photo'', fp.photo,
    ''creationDate'', fp.creation_date,
    ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
    ''finishedProductTypeId'', fp.finished_product_type_id,
    ''measure'', json_build_object(
        ''identifier'', ub.name,
        ''type'', ub."type"
    ),
    ''status'', json_build_object(
    	''id'', s.id,
    	''identifier'', s.name,
        ''name'', s.name,
        ''type'', s."type"
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM finished_product fp
LEFT JOIN unit_base ub ON ub.id = fp.unit_base_id
LEFT JOIN status s ON s.id = fp.status_id
LEFT JOIN "user" u ON u.id = fp.creator_user_id','finished_product','POST');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveRawMaterialByProvider','/retrieveRawMaterialByProvider','SELECT json_agg(
    json_build_object(
        ''id'', rmbp.id,
        ''rawMaterialByProviderTypeId'', rmbp.raw_material_by_provider_type_id,
        ''price'', rmbp.price,
        ''updatedDate'', coalesce(rmbp.updated_date, rmbp.creation_date),
        ''creationDate'', rmbp.creation_date,
        ''rawMaterialBase'', json_build_object(
        	''id'', rm.id,
            ''name'', rm.name,
            ''description'', rm.description,
            ''photo'', rm.photo,
            ''measure'', json_build_object(
                ''identifier'', ub.name,
                ''type'', ub."type"
            )
        ),
        ''status'', json_build_object(
        	''id'', s.id,
            ''identifier'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        ),
        ''provider'', json_build_object(
        	''id'', p.id,
            ''name'', p.name,
            ''email'', p.email
        )
    )
) as json_result
FROM raw_material_by_provider rmbp
LEFT JOIN raw_material rm ON rmbp.raw_material_base_id = rm.id
LEFT JOIN unit_base ub ON rm.unit_base_id = ub.id
LEFT JOIN provider p ON p.id = rmbp.provider_id
LEFT JOIN status s ON s.id = rmbp.status_id
LEFT JOIN "user" u ON u.id = rmbp.creator_user_id','raw_material_by_provider','POST'),
	 ('retrieveFinishedProductInventory','/retrieveFinishedProductInventory','SELECT json_build_object(
    ''id'', i.id,
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''creationDate'', ie.creation_date,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''finishedProduct'', json_build_object(
                    ''id'', fp.id,
                    ''name'', fp.name,
                    ''photo'', fp.photo,
                    ''finishedProductTypeId'', fp.finished_product_type_id,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub2.name
                    )
                )
            )
            ORDER BY fp.creation_date
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON sie.id = ie.status_id
        LEFT JOIN measure m ON m.id = ie.measure_id
        LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
        left JOIN finished_product fp ON fp.id = ie.element_fk
        left join unit_base ub2 on ub2.id = fp.unit_base_id 
        LEFT JOIN status srm ON srm.id = fp.status_id
        WHERE ie.element_type = ''finished_product''
          AND ie.inventory_id = i.id
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''finished_product''','inventory','POST'),
	 ('listRawMaterialOrder','/listRawMaterialOrder','SELECT json_agg(
    json_build_object(
        ''id'', rmo.id,
        ''paidAmount'', rmo.paid_amount,
        ''finalAmount'', rmo.final_amount,
        ''pendingAmount'', rmo.pending_amount,
        ''name'', rmo."name",
        ''description'', rmo.description,
        ''creationDate'', rmo.creation_date,
        ''updatedDate'', coalesce(rmo.updated_date, rmo.creation_date),
        ''status'', json_build_object(
            ''identifier'', s.name,
            ''id'', s.id
        ),
        ''paymentStatus'', json_build_object(
            ''identifier'', s2.name,
            ''id'', s2.id
        ),
        ''paymentType'', json_build_object(
            ''identifier'', pt.name,
            ''id'', pt.id
        ),
        ''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email,
            ''id'', u.id
        ),
        ''provider'', json_build_object(
            ''name'', p.name,
            ''id'', p.id
        ),
        ''rawMaterialByProviderTypeId'', rmo.raw_material_by_provider_type_id
    )
) AS json_result
FROM raw_material_order rmo
LEFT JOIN status s ON s.id = rmo.status_id
LEFT JOIN status s2 ON s2.id = rmo.payment_status_id
LEFT JOIN payment_type pt ON pt.id = rmo.payment_type_id
LEFT JOIN "user" u ON u.id = rmo.creator_user_id
LEFT JOIN provider p ON p.id = rmo.provider_id','raw_material_order','POST'),
	 ('tempGetNewStoreCashClosing','/tempGetNewStoreCashClosing','SELECT json_build_object(
	''lastInventoryCreationDate'', (select max(creation_date) from cash_closing cc1 where cc1.status_id = 55 and cc1.establishment_id = e.id),
	''establishment'', json_build_object(
		''id'', e.id,
		''name'', e."name"
	),
	''saleStoreOrders'', (
		SELECT json_agg(
		    json_build_object(
		        ''id'', pfsso.id,
		        ''name'', pfsso.name,
		        ''comment'', pfsso.comment,
		        ''finalAmount'', pfsso.final_amount,
		        ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
		        ''creationDate'', pfsso.creation_date,
		        ''storeStatus'', json_build_object(
		            ''identifier'', s.name,
		            ''id'', s.id
		        ),
		        ''factoryStatus'', json_build_object(
		            ''identifier'', s2.name,
		            ''id'', s2.id
		        ),
		        ''creatorUser'', json_build_object(
		            ''name'', u.username,
		            ''email'', u.email,
		            ''id'', u.id
		        )
		    )
		) AS json_result
		from product_for_sale_store_order pfsso 
		left join establishment e2 on e2.id = pfsso.establishment_id
		left join status s on s.id = pfsso.store_status_id
		left join status s2 on s2.id = pfsso.factory_status_id
		left join "user" u on u.id = pfsso.creator_user_id
		where e.id = pfsso.establishment_id
	),
	''shopResumes'', (
		SELECT json_agg(
		    json_build_object(
		        ''id'', ss.id,
			    ''nameClient'', ss.name_client,
			    ''nitClient'', ss.nit_client,
			    ''nota'', ss.nota,
			    ''total'', ss.total,
			    ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
			    ''creationDate'', ss.creation_date,
			    ''status'', json_build_object(
			        ''identifier'', s.name,
			        ''id'', s.id
			    ),
			    ''paymentType'', json_build_object(
			        ''identifier'', pt."name",
			        ''id'', pt.id
			    ),
			    ''itemsList'', (
				    SELECT json_agg(
					    json_build_object(
					    	''id'', sse.id,
					    	''productForSale'', json_build_object(
						        ''id'', pfs.id,
						        ''finishedProduct'', json_build_object(
						            ''id'', fp.id,
						            ''name'', fp.name
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
		    )
		) AS json_result
		from shop_sale ss 
		left join status s on ss.status_id = s.id
		left join payment_type pt on ss.payment_type_id = pt.id
		left join "user" u on ss.creator_user_id = u.id
		left join establishment e3 on ss.establishment_id = e3.id
		where e.id = ss.establishment_id
	),
	''inventoryCapture'', (
		SELECT json_build_object(
		    ''inventory_id'', i.id,
		    ''inventory_type'', i.inventory_type,
		    ''unit_name'', i.unit_name,
		    ''creator_user_id'', i.creator_user_id,
		    ''status_id'', i.status_id,
		    ''creation_date'', i.creation_date,
		    ''inventoryElements'', (
		        SELECT json_agg(
		            json_build_object(
		                ''id'', ie.id,
		                ''element_type'', ie.element_type,
		                ''quantity'', ie.quantity,
		                ''status'', json_build_object(
		                    ''identifier'', sie.name,
		                    ''id'', sie.id
		                ),
		                ''measure'', json_build_object(
		                    ''id'', m.id,
		                    ''identifier'', m.name,
		                    ''unitBase'', json_build_object(
		                        ''quantity'', m.unit_base_quantity,
		                        ''name'', ub.name,
		                        ''id'', ub.id
		                    )
		                ),
		                ''productForSale'', json_build_object(
		                	''id'', pfs.id,
		                	''price'', pfs.price,
			                ''finishedProduct'', json_build_object(
			                    ''id'', fp.id,
			                    ''name'', fp.name,
			                    ''photo'', fp.photo,
			                    ''status'', json_build_object(
			                        ''id'', srm.id,
			                        ''identifier'', srm.name
			                    )
			                )
		                )
		            )
		        )
		        FROM inventory_element ie
		        join product_for_sale pfs on ie.element_fk = pfs.id
		        left JOIN finished_product fp ON fp.id = pfs.finished_product_id
		        LEFT JOIN status sie ON sie.id = ie.status_id
		        LEFT JOIN measure m ON m.id = ie.measure_id
		        LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
		        LEFT JOIN status srm ON srm.id = fp.status_id
		        WHERE ie.element_type = ''product_for_sale''
		          AND ie.inventory_id = i.id
		    )
		) AS json_result
		FROM inventory i
		WHERE i.inventory_type = ''product_for_sale'' and i.unit_name = e.id::text
		LIMIT 1
	),
	''inventoryElementActions'', (
		SELECT json_agg(
		    json_build_object(
		    	''id'', iea.id,
		    	''creationDate'', iea.creation_date,
		    	''reason'', iea."comment",
		    	''element'', json_build_object(
		    		''name'', fp3."name"
		    	),
		    	''measure'', json_build_object(
		            ''identifier'', m3.name,
		            ''unitBase'', json_build_object(
		                ''quantity'', m3.unit_base_quantity
		            )
		        ),
		    	''quantity'', iea.quantity,
		    	''creatorUser'', json_build_object(
		            ''name'', u3.username,
		            ''email'', u3.email
		        ),
		        ''actionType'', json_build_object(
		        	''color'', at.color,
		        	''action'', at.action,
		            ''name'', at."name"
		        )
		    )
		) as json_result
		from inventory_element_action iea
		left join inventory_element ie3 on ie3.id = iea.source_inventory_element_id
		left join inventory i3 on i3.id = ie3.inventory_id
		left join measure m3 on m3.id = iea.measure_id 
		left join "user" u3 on u3.id = iea.creator_user_id
		left join action_type at on at.id = iea.action_type_id 
		join product_for_sale pfs3 on ie3.element_fk = pfs3.id
		left JOIN finished_product fp3 ON fp3.id = pfs3.finished_product_id
		where i3.unit_name = e.id::text
	)
) as json_result
from establishment e ','cash_closing','POST'),
	 ('getNewStoreCashClosing','/getNewStoreCashClosing','SELECT json_build_object(
	''lastInventoryCreationDate'', (select max(creation_date) from cash_closing cc1 where cc1.status_id in (55,57) and cc1.establishment_id = e.id),
	''establishment'', json_build_object(
		''id'', e.id,
		''name'', e."name"
	),
	''saleStoreOrders'', (
		SELECT json_agg(
		    json_build_object(
		        ''id'', pfsso.id,
		        ''name'', pfsso.name,
		        ''comment'', pfsso.comment,
		        ''finalAmount'', pfsso.final_amount,
		        ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
		        ''creationDate'', pfsso.creation_date,
		        ''storeStatus'', json_build_object(
		            ''identifier'', s.name,
		            ''id'', s.id
		        ),
		        ''factoryStatus'', json_build_object(
		            ''identifier'', s2.name,
		            ''id'', s2.id
		        ),
		        ''creatorUser'', json_build_object(
		            ''name'', u.username,
		            ''email'', u.email,
		            ''id'', u.id
		        ),
		        ''productForSaleStoreOrderElements'', (
				    SELECT json_agg(
					    json_build_object(
					    	''id'', pfssoe.id,
					    	''price'', pfssoe.price,
					    	''quantity'', pfssoe.quantity,
					    	''totalPrice'', pfssoe.total_price,
					    	''date'', pfssoe."date",
					    	''measure'', json_build_object(
					    		''identifier'', m1.name,
					    		''id'', m1.id
					    	),
					        ''productForSale'', json_build_object(
					        	''id'', pfs.id,
						        ''creationDate'', pfs.creation_date,
							    ''updatedDate'', pfs.updated_date,
						        ''price'', pfs.price,
						        ''finishedProduct'', json_build_object(
						            ''id'', fp.id,
						            ''name'', fp.name,
						            ''photo'', fp.photo,
						            ''description'', fp.description
						        )
					        )
					    )
					)
					from product_for_sale_store_order_element pfssoe
					LEFT JOIN measure m1 on m1.id = pfssoe.measure_id
					left join product_for_sale pfs on pfs.id = pfssoe.product_for_sale_id
					LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
					LEFT JOIN establishment e3 ON e3.id = pfs.establishment_id
					LEFT JOIN status s3 ON s3.id = pfs.status_id
					WHERE pfssoe.pfsso_id = pfsso.id
				)
		    )
		) AS json_result
		from product_for_sale_store_order pfsso 
		left join establishment e2 on e2.id = pfsso.establishment_id
		left join status s on s.id = pfsso.store_status_id
		left join status s2 on s2.id = pfsso.factory_status_id
		left join "user" u on u.id = pfsso.creator_user_id
		where e.id = pfsso.establishment_id
		and ((select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id) IS NULL OR pfsso.creation_date >= (select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id)) 
	),
	''shopResumes'', (
		SELECT json_agg(
		    json_build_object(
		        ''id'', ss.id,
			    ''nameClient'', ss.name_client,
			    ''nitClient'', ss.nit_client,
			    ''nota'', ss.nota,
			    ''total'', ss.total,
			    ''totalDiscount'', ss.total_discount,
			    ''delivery'', ss.delivery,
			    ''paidAmount'', ss.paid_amount,
			    ''pendingAmount'', ss.pending_amount,
			    ''deliveryPendingAmount'', ss.delivery_pending_amount,
			    ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
			    ''creationDate'', ss.creation_date,
			    ''status'', json_build_object(
			        ''identifier'', s.name,
			        ''id'', s.id
			    ),
			    ''paymentType'', json_build_object(
			        ''identifier'', pt."name",
			        ''id'', pt.id
			    ),
			    ''deliveryPaymentType'', json_build_object(
			        ''identifier'', dpt."name",
			        ''id'', dpt.id
			    ),
			    ''itemsList'', (
				    SELECT json_agg(
					    json_build_object(
					    	''id'', sse.id,
					    	''quantity'', sse.quantity,
					    	''price'', sse.price,
					    	''totalDiscount'', sse.total_discount,
					    	''total'', sse.total,
					    	''productForSale'', json_build_object(
						        ''id'', pfs.id,
						        ''finishedProduct'', json_build_object(
						            ''id'', fp.id,
						            ''name'', fp.name
						        )
							),
							''measure'', json_build_object(
								''identifier'', m2."name",
								''id'', m2.id
							)
					    )
					)
					from shop_sale_element sse
					left join product_for_sale pfs on pfs.id = sse.product_for_sale_id 
					LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
					left join measure m2 on sse.measure_id = m2.id
					WHERE sse.shop_sale_id = ss.id
				),
			    ''payments'', (
				    SELECT json_agg(json_build_object(
				        ''amount'', ssp.amount,
				        ''date'', ssp."date",
				        ''paymentType'', json_build_object(
				            ''identifier'', pt_pay."name",
				            ''id'', pt_pay.id
				        )
				    ))
				    FROM shop_sale_payment ssp
				    JOIN payment_type pt_pay ON pt_pay.id = ssp.payment_type_id
				    WHERE ssp.shop_sale_id = ss.id
				)
		    )
		) AS json_result
		from shop_sale ss
		left join status s on ss.status_id = s.id
		left join payment_type pt on ss.payment_type_id = pt.id
		left join payment_type dpt on ss.delivery_payment_type_id = dpt.id
		left join "user" u on ss.creator_user_id = u.id
		left join establishment e3 on ss.establishment_id = e3.id
		where e.id = ss.establishment_id
		and ss.status_id = 52
		and ((select max(creation_date) from cash_closing cc1 where  cc1.establishment_id = e.id) IS NULL OR ss.creation_date >= (select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id))
	),
	''creditPayments'', (
		SELECT json_agg(json_build_object(
			''id'', ssp.id,
			''amount'', ssp.amount,
			''date'', ssp."date",
			''paymentTarget'', ssp.payment_target,
			''paymentType'', json_build_object(
				''identifier'', pt_pay."name",
				''id'', pt_pay.id
			),
			''shopSale'', json_build_object(
				''id'', ss.id,
				''nameClient'', ss.name_client,
				''nitClient'', ss.nit_client,
				''total'', ss.total,
				''paymentType'', json_build_object(
					''identifier'', pt."name",
					''id'', pt.id
				),
				''creationDate'', ss.creation_date,
				''updatedDate'', coalesce(ss.updated_date, ss.creation_date)
			)
		) ORDER BY ssp."date" DESC)
		FROM shop_sale_payment ssp
		JOIN payment_type pt_pay ON pt_pay.id = ssp.payment_type_id
		JOIN shop_sale ss ON ss.id = ssp.shop_sale_id
		LEFT JOIN payment_type pt ON pt.id = ss.payment_type_id
		WHERE ss.establishment_id = e.id
		AND ss.status_id = 52
		AND ((select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id) IS NULL OR ssp."date" >= (select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id))
	),
	''lastInventory'', (select inventory_capture from cash_closing where establishment_id = e.id order by creation_date desc limit 1),
	''inventoryCapture'', (
		SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''productForSale'', json_build_object(
                	''id'', pfs.id,
                	''price'', pfs.price,
	                ''finishedProduct'', json_build_object(
	                    ''id'', fp.id,
	                    ''name'', fp.name,
	                    ''photo'', fp.photo,
	                    ''status'', json_build_object(
	                        ''id'', srm.id,
	                        ''identifier'', srm.name
	                    )
	                )
                )
            )
        )
        FROM inventory i1
        join inventory_element ie on i1.id = ie.inventory_id
        join product_for_sale pfs on ie.element_fk = pfs.id
        left JOIN finished_product fp ON fp.id = pfs.finished_product_id
        LEFT JOIN status sie ON sie.id = ie.status_id
        LEFT JOIN measure m ON m.id = ie.measure_id
        LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
        LEFT JOIN status srm ON srm.id = fp.status_id
        WHERE ie.element_type = ''product_for_sale''
          and i1.unit_name = e.id::text
	),
	''inventoryElementActions'', (
		SELECT json_agg(
		    json_build_object(
		    	''id'', iea.id,
		    	''creationDate'', iea.creation_date,
		    	''reason'', iea."comment",
		    	''element'', json_build_object(
		    		''name'', fp3."name"
		    	),
		    	''price'', pfs3.price,
		    	''measure'', json_build_object(
		            ''identifier'', m3.name,
		            ''unitBase'', json_build_object(
		                ''quantity'', m3.unit_base_quantity
		            )
		        ),
		    	''quantity'', iea.quantity,
		    	''creatorUser'', json_build_object(
		            ''name'', u3.username,
		            ''email'', u3.email
		        ),
		        ''actionType'', json_build_object(
		        	''color'', at.color,
		        	''action'', at.action,
		        	''type'', at.type,
		            ''name'', at."name"
		        )
		    )
		) as json_result
		from inventory_element_action iea
		left join inventory_element ie3 on ie3.id = iea.source_inventory_element_id
		left join inventory i3 on i3.id = ie3.inventory_id
		left join measure m3 on m3.id = iea.measure_id 
		left join "user" u3 on u3.id = iea.creator_user_id
		left join action_type at on at.id = iea.action_type_id 
		join product_for_sale pfs3 on ie3.element_fk = pfs3.id
		left JOIN finished_product fp3 ON fp3.id = pfs3.finished_product_id
		where i3.unit_name = e.id::text
		and ((select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id) IS NULL OR iea.creation_date >= (select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id))
	),
	''storeExpenses'', (
		SELECT json_agg(json_build_object(
			''id'', se.id,
			''title'', se.title,
			''totalAmount'', se.total_amount,
			''comment'', se.comment,
			''supplier'', se.supplier,
			''nit'', se.nit,
			''creationDate'', se.creation_date
		))
		FROM store_expense se
		WHERE se.establishment_id = e.id
		AND se.status_id = 58
		AND ((select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id) IS NULL OR se.creation_date >= (select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id))
	),
	''previousCreditBalance'', (
		SELECT COALESCE(credit_balance, 0)
		FROM cash_closing
		WHERE establishment_id = e.id
		ORDER BY creation_date DESC
		LIMIT 1
	)
) as json_result
from establishment e ','cash_closing','POST'),
	 ('listStoreCashClosing','/listStoreCashClosing','SELECT json_agg(json_build_object(
	''id'', cc.id,
	''creationDate'', cc.creation_date, 
	''note'', cc.note,
	''userRequest'', json_build_object(
		''name'', u.username
	),
	''status'', json_build_object(
		''identifier'', s."name" 
	)
)) as json_result
from cash_closing cc
left join "user" u on u.id = cc.validator_user
left join status s on s.id = cc.status_id','cash_closing','POST'),
	 ('retrivePackagingMaterialInventoryActions','/retrivePackagingMaterialInventoryActions','SELECT json_agg(
    json_build_object(
    	''id'', iea.id,
    	''creationDate'', iea.creation_date,
    	''reason'', iea."comment",
    	''element'', json_build_object(
    		''name'', rm."name"
    	),
    	''measure'', json_build_object(
            ''identifier'', m.name,
            ''unitBase'', json_build_object(
                ''quantity'', m.unit_base_quantity
            )
        ),
    	''quantity'', iea.quantity,
    	''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email
        ),
        ''actionType'', json_build_object(
        	''color'', at.color,
        	''action'', at.action,
            ''name'', at."name"
        )
    )
) as json_result
from inventory_element_action iea
left join inventory_element ie on ie.id = iea.source_inventory_element_id
left join inventory i on i.id = ie.inventory_id
left join measure m on m.id = iea.measure_id
left join "user" u on u.id = iea.creator_user_id
left join action_type at on at.id = iea.action_type_id
join raw_material rm on ie.element_fk = rm.id','inventory_element_action','POST'),
	 ('getShopSale','/getShopSale','select json_build_object(
    ''id'', ss.id,
    ''nameClient'', ss.name_client,
    ''nitClient'', ss.nit_client,
    ''nota'', ss.nota,
    ''total'', ss.total,
    ''totalDiscount'', ss.total_discount,
    ''delivery'', ss.delivery,
    ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
    ''creationDate'', ss.creation_date,
    ''status'', json_build_object(
        ''identifier'', s.name,
        ''id'', s.id
    ),
    ''creatorUser'', json_build_object(
        ''name'', u.username,
        ''email'', u.email,
        ''id'', u.id
    ),
    ''establishment'', json_build_object(
        ''identifier'', e."name",
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
left join payment_type pt on ss.payment_type_id = pt.id
left join "user" u on ss.creator_user_id = u.id
left join establishment e on ss.establishment_id = e.id','shop_sale','POST'),
	 ('deleteStoreCashClosing','/deleteStoreCashClosing','delete from cash_closing
where id = $1','cash_closing','PATCH'),
	 ('retrieveStoreCashClosing','/retrieveStoreCashClosing','SELECT json_build_object(
	''id'', cc.id,
	''creationDate'', cc.creation_date,
	''note'', cc.note,
	''sobrante'', cc.sobrante,
	''creditBalance'', cc.credit_balance,
	''userRequest'', json_build_object(
		''name'', u.username,
		''email'', u.email
	),
	''userValidator'', json_build_object(
		''name'', u2.username,
		''email'', u2.email
	),
	''status'', json_build_object(
		''id'', s.id,
		''identifier'', s."name"
	),
	''establishment'', cc.establishment_id,
	''saleStoreOrders'', cc.sale_store_orders,
	''shopResumes'', cc.shop_sales,
	''lastInventory'', cc.last_inventory_capture,
	''lastInventoryCreationDate'', cc.last_inventory_creation_date,
	''inventoryCapture'', cc.inventory_capture,
	''inventoryElementActions'', cc.inventory_element_actions,
	''previousCreditBalance'', (
		SELECT cc2.credit_balance
		FROM cash_closing cc2
		WHERE cc2.establishment_id = cc.establishment_id
		  AND cc2.creation_date < cc.creation_date
		  AND cc2.status_id != 56
		ORDER BY cc2.creation_date DESC
		LIMIT 1
	),
	''storeExpenses'', (
		SELECT json_agg(json_build_object(
			''id'', se.id, ''title'', se.title, ''totalAmount'', se.total_amount,
			''comment'', se.comment, ''supplier'', se.supplier, ''nit'', se.nit,
			''creationDate'', se.creation_date,
			''status'', json_build_object(''id'', se_s.id, ''identifier'', se_s."name")
		))
		FROM store_expense se
		JOIN status se_s ON se_s.id = se.status_id
		WHERE se.establishment_id = cc.establishment_id
		  AND se.status_id = 58
		  AND se.creation_date >= COALESCE(
			(SELECT max(cc3.creation_date) FROM cash_closing cc3
			 WHERE cc3.establishment_id = cc.establishment_id
			   AND cc3.creation_date < cc.creation_date
			   AND cc3.status_id != 56),
			''1900-01-01''::timestamp
		  )
		  AND se.creation_date <= cc.creation_date
	),
	''creditPayments'', (
		SELECT json_agg(json_build_object(
			''id'', ssp.id,
			''amount'', ssp.amount,
			''date'', ssp."date",
			''paymentTarget'', ssp.payment_target,
			''paymentType'', json_build_object(
				''identifier'', pt_pay."name",
				''id'', pt_pay.id
			),
			''shopSale'', json_build_object(
				''id'', ss.id,
				''nameClient'', ss.name_client,
				''nitClient'', ss.nit_client,
				''total'', ss.total,
				''paymentType'', json_build_object(
					''identifier'', pt."name",
					''id'', pt.id
				),
				''creationDate'', ss.creation_date,
				''updatedDate'', coalesce(ss.updated_date, ss.creation_date)
			)
		) ORDER BY ssp."date" DESC)
		FROM shop_sale_payment ssp
		JOIN payment_type pt_pay ON pt_pay.id = ssp.payment_type_id
		JOIN shop_sale ss ON ss.id = ssp.shop_sale_id
		LEFT JOIN payment_type pt ON pt.id = ss.payment_type_id
		WHERE ss.establishment_id = cc.establishment_id
		  AND ss.status_id = 52
		  AND ssp."date" >= COALESCE(
			(SELECT max(cc4.creation_date) FROM cash_closing cc4
			 WHERE cc4.establishment_id = cc.establishment_id
			   AND cc4.creation_date < cc.creation_date
			   AND cc4.status_id != 56),
			''1900-01-01''::timestamp
		  )
		  AND ssp."date" <= cc.creation_date
	)
) as json_result
from cash_closing cc
left join "user" u on u.id = cc.validator_user
left join "user" u2 on u2.id = cc.confirm_user
left join status s on s.id = cc.status_id','cash_closing','POST');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getStoreCashClosingV2','/getStoreCashClosingV2','SELECT json_build_object(
	''id'', cc.id, ''creationDate'', cc.creation_date, ''note'', cc.note,
	''sobrante'', cc.sobrante, ''creditBalance'', cc.credit_balance,
	''userRequest'', json_build_object(''name'', u.username, ''email'', u.email),
	''userValidator'', json_build_object(''name'', u2.username, ''email'', u2.email),
	''status'', json_build_object(''id'', s.id, ''identifier'', s."name"),
	''establishment'', cc.establishment_id,
	''saleStoreOrders'', cc.sale_store_orders,
	''shopResumes'', cc.shop_sales,
	''lastInventory'', cc.last_inventory_capture,
	''lastInventoryCreationDate'', cc.last_inventory_creation_date,
	''inventoryCapture'', cc.inventory_capture,
	''inventoryElementActions'', cc.inventory_element_actions,
	''previousCreditBalance'', (
		SELECT cc2.credit_balance FROM cash_closing cc2
		WHERE cc2.establishment_id = cc.establishment_id AND cc2.creation_date < cc.creation_date AND cc2.status_id != 56
		ORDER BY cc2.creation_date DESC LIMIT 1
	),
	''storeExpenses'', (
		SELECT json_agg(json_build_object(''id'', se.id, ''title'', se.title, ''totalAmount'', se.total_amount, ''comment'', se.comment, ''supplier'', se.supplier, ''nit'', se.nit, ''creationDate'', se.creation_date, ''status'', json_build_object(''id'', se_s.id, ''identifier'', se_s."name")))
		FROM store_expense se
		JOIN status se_s ON se_s.id = se.status_id
		WHERE se.establishment_id = cc.establishment_id AND se.status_id = 58
		  AND se.creation_date >= COALESCE((SELECT max(cc3.creation_date) FROM cash_closing cc3 WHERE cc3.establishment_id = cc.establishment_id AND cc3.creation_date < cc.creation_date AND cc3.status_id != 56), ''1900-01-01''::timestamp)
		  AND se.creation_date <= cc.creation_date
	),
	''creditPayments'', (
		SELECT json_agg(json_build_object(
			''id'', ssp.id, ''amount'', ssp.amount, ''date'', ssp."date",
			''paymentTarget'', ssp.payment_target,
			''paymentType'', json_build_object(''identifier'', pt_pay."name", ''id'', pt_pay.id),
			''shopSale'', json_build_object(
				''id'', ss.id, ''nameClient'', ss.name_client, ''nitClient'', ss.nit_client, ''total'', ss.total,
				''paymentType'', json_build_object(''identifier'', pt."name", ''id'', pt.id),
				''creationDate'', ss.creation_date, ''updatedDate'', coalesce(ss.updated_date, ss.creation_date))
		) ORDER BY ssp."date" DESC)
		FROM shop_sale_payment ssp
		JOIN payment_type pt_pay ON pt_pay.id = ssp.payment_type_id
		JOIN shop_sale ss ON ss.id = ssp.shop_sale_id
		LEFT JOIN payment_type pt ON pt.id = ss.payment_type_id
		WHERE ss.establishment_id = cc.establishment_id AND ss.status_id = 52
		  AND ssp."date" >= COALESCE((SELECT max(cc4.creation_date) FROM cash_closing cc4 WHERE cc4.establishment_id = cc.establishment_id AND cc4.creation_date < cc.creation_date AND cc4.status_id != 56), ''1900-01-01''::timestamp)
		  AND ssp."date" <= cc.creation_date
	)
) as json_result
from cash_closing cc
left join "user" u on u.id = cc.validator_user
left join "user" u2 on u2.id = cc.confirm_user
left join status s on s.id = cc.status_id','cash_closing','POST');

-- ============================================================
-- OJO: las versiones que consume el front hoy NO están en este archivo; se
-- derivan de las de arriba con replace() dentro de las migraciones, para no
-- duplicar ~200 líneas de SQL en cada versión:
--   /getNewStoreCashClosing   -> V2 (migration_shop_sale_customer.sql)
--                             -> V3 (migrations/2026-08-02-add-shop-sale-payment-comment.sql)
--   /retrieveStoreCashClosing -> V3 (migration_shop_sale_customer.sql)
--                             -> V4 (migrations/2026-08-02-add-shop-sale-payment-comment.sql)
--   /getStoreCashClosingV2    -> V3 (migration_shop_sale_customer.sql)
--                             -> V4 (migrations/2026-08-02-add-shop-sale-payment-comment.sql)
-- Al sembrar una base nueva: correr este archivo y después las migraciones en
-- orden cronológico.
-- ============================================================

INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getProductForSale','/getProductForSale','SELECT json_build_object(
    ''id'', pfs.id,
    ''price'', pfs.price,
    ''creationDate'', pfs.creation_date,
    ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
    ''finishedProduct'', json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''photo'', fp.photo,
        ''description'', fp.description,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        )
    ),
    ''status'', json_build_object(
        ''name'', s.name,
        ''identifier'', s.name,
        ''type'', s."type"
    ),
    ''establishment'', json_build_object(
        ''id'', e.id,
        ''name'', e.name
    ),
    ''creatorUser'', json_build_object(
        ''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM product_for_sale pfs
LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
LEFT JOIN establishment e ON e.id = pfs.establishment_id
LEFT JOIN status s ON s.id = pfs.status_id
left join "user" u on u.id = pfs.creator_user_id','product_for_sale','POST'),
	 ('verifyCashClosing','/verifyCashClosing','call verify_cash_closing($1::uuid, $2::uuid)','cash_closing','PATCH'),
	 ('addStoreCashClosing','/addStoreCashClosing','call register_cash_closing($1, $2::uuid, $3::uuid)','cash_closing','PATCH'),
	 ('addStoreCashClosingV3','/addStoreCashClosingV3','call register_cash_closing($1, $2::uuid, $3::uuid, $4::numeric)','cash_closing','PATCH'),
	 ('addStoreCashClosingV4','/addStoreCashClosingV4','call register_cash_closing_v4($1, $2::uuid, $3::uuid, $4::numeric)','cash_closing','PATCH'),
	 ('updateStoreCashClosing','/updateStoreCashClosing','update cash_closing
set updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP), note = $1
where id = $2','cash_closing','PATCH'),
	 ('registerUser','/registerUser','INSERT INTO "user"
(external_id, username, status_id, email, role_id)
VALUES($1, $2, 6, $3, $4)','user','PATCH'),
	 ('updateUser','/updateUser','update "user"
set username = $1, phone = $2, status_id = $3, role_id = $4
where id = $5::uuid','user','PATCH'),
	 ('retrieveRawMaterialInventory','/retrieveRawMaterialInventory','SELECT json_build_object(
    ''id'', i.id,
    ''name'', i."name",
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''updatedDate'', i.updated_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''rawMaterialBase'', json_build_object(
                    ''id'', rm.id,
                    ''name'', rm.name,
                    ''photo'', rm.photo,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub.name
                    )
                )
            )
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON ie.status_id = sie.id
        LEFT JOIN measure m ON ie.measure_id = m.id
        LEFT JOIN unit_base ub ON m.unit_base_id = ub.id
        JOIN raw_material rm ON ie.element_fk = rm.id
        left join unit_base ub2 on ub2.id = rm.unit_base_id 
        LEFT JOIN status srm ON srm.id = rm.status_id
        WHERE ie.element_type = ''raw_material''
          AND ie.inventory_id = i.id
    )
) as json_result
FROM inventory i
where i.inventory_type = ''raw_material''','inventory','POST'),
	 ('deleteProductForSaleStoreOrder','/deleteProductForSaleStoreOrder','update product_for_sale_store_order 
set store_status_id = 24, factory_status_id = 24
where id = $1','product_for_sale_store_order','PATCH'),
	 ('listShopSale','/listShopSale','SELECT json_agg(
    json_build_object(
        ''id'', ss.id,
	    ''nameClient'', ss.name_client,
	    ''nitClient'', ss.nit_client,
	    ''nota'', ss.nota,
	    ''total'', ss.total,
	    ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
	    ''creationDate'', ss.creation_date,
	    ''status'', json_build_object(
	        ''identifier'', s.name,
	        ''id'', s.id,
			''bg_color'', s.bg_color,
	        ''color'', s.color
	    ),
	    ''itemsList'', (
		    SELECT json_agg(
			    json_build_object(
			    	''id'', sse.id,
			    	''productForSale'', json_build_object(
				        ''id'', pfs.id,
				        ''finishedProduct'', json_build_object(
				            ''id'', fp.id,
				            ''name'', fp.name
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
    )
) AS json_result
from shop_sale ss 
left join status s on ss.status_id = s.id
left join payment_type pt on ss.payment_type_id = pt.id
left join "user" u on ss.creator_user_id = u.id
left join establishment e on ss.establishment_id = e.id','shop_sale','POST'),
	 ('updateProductForSaleStoreOrderEnCamino','/updateProductForSaleStoreOrderEnCamino','update product_for_sale_store_order 
set factory_status_id = 1, store_status_id = 20, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','product_for_sale_store_order','PATCH');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getUser','/getUser','select jsonb_build_object(
    ''id'', u.id,
    ''ext_id'', u.external_id,
    ''name'', u.username,
    ''password'', u.password,
    ''email'', u.email,
    ''phone'', u.phone,
    ''creationDate'', u.creation_date,
    ''updatedDate'', coalesce(u.updated_date, u.creation_date),
    ''role'', jsonb_build_object(
        ''id'', r.id,
        ''identifier'', r.name,
        ''status'', r.status,
        ''paths'', paths::jsonb
    ),
    ''status'', jsonb_build_object(
        ''id'', s.id,
        ''identifier'', s.name,
        ''type'', s."type"
    )
) as json_result
from "user" u 
left join "role" r on u.role_id = r.id
left join "status" s on u.status_id = s.id','user','POST'),
	 ('createUser','/createUser','INSERT INTO "user"
(username, status_id, email, phone, role_id, external_id)
VALUES($1, $2, $3, $4, $5, $6)','user','PATCH'),
	 ('Test','/Test','SELECT * FROM sql_queries','sql_queries','GET'),
	 ('getRawMaterialOrder','/getRawMaterialOrder','SELECT json_build_object(
    ''id'', rmo.id,
    ''paidAmount'', rmo.paid_amount,
    ''finalAmount'', rmo.final_amount,
    ''pendingAmount'', rmo.pending_amount,
    ''name'', rmo."name",
    ''description'', rmo.description,
    ''comment'', rmo.description,
    ''creationDate'', rmo.creation_date,
    ''updatedDate'', coalesce(rmo.updated_date, rmo.creation_date),
    ''status'', json_build_object(
        ''identifier'', s.name,
        ''id'', s.id
    ),
    ''paymentStatus'', json_build_object(
        ''identifier'', s2.name,
        ''id'', s2.id
    ),
    ''paymentType'', json_build_object(
        ''identifier'', pt.name,
        ''id'', pt.id
    ),
    ''creatorUser'', json_build_object(
        ''name'', u.username,
        ''email'', u.email,
        ''id'', u.id
    ),
    ''provider'', json_build_object(
        ''name'', p.name,
        ''email'', p.email,
        ''id'', p.id
    ),
    ''rawMaterialOrderElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', rmoe.id,
                ''price'', rmoe.price,
                ''discount'', rmoe.discount,
                ''quantity'', rmoe.quantity,
                ''subtotalPrice'', rmoe.subtotal_price,
                ''totalDiscount'', rmoe.total_discount,
                ''totalPrice'', rmoe.total_price,
                ''rawMaterialByProvider'', json_build_object(
                	''id'', rmbp.id,
                    ''rawMaterialBase'', json_build_object(
                        ''name'', rm.name,
                        ''id'', rm.id
                    ),
                    ''provider'', json_build_object(
                        ''name'', p.name,
                        ''id'', p.id,
                        ''email'', p.email
                    )
                ),
                ''measure'', json_build_object(
                    ''identifier'', m.name,
                    ''id'', m.id,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''id'', m.unit_base_id
                    )
                )
            )
        )
        FROM raw_material_order_element rmoe
        LEFT JOIN measure m ON m.id = rmoe.measure_id
        LEFT JOIN raw_material_by_provider rmbp ON rmbp.id = rmoe.raw_material_by_provider_id
        LEFT JOIN raw_material rm ON rm.id = rmbp.raw_material_base_id
        LEFT JOIN provider p ON rmbp.provider_id = p.id
        WHERE rmoe.raw_material_order_id = rmo.id
    ),
    ''rawMaterialOrderPayments'', (
        SELECT json_agg(
            json_build_object(
                ''date'', rmop.date,
                ''amount'', rmop.amount,
                ''paymentType'', pt2.name
            )
        )
        FROM raw_material_order_payment rmop
        LEFT JOIN payment_type pt2 ON rmop.payment_type_id = pt2.id
        WHERE rmop.raw_material_order_id = rmo.id
    )
) AS json_result
FROM raw_material_order rmo
LEFT JOIN status s ON s.id = rmo.status_id
LEFT JOIN status s2 ON s2.id = rmo.payment_status_id
LEFT JOIN payment_type pt ON pt.id = rmo.payment_type_id
LEFT JOIN "user" u ON u.id = rmo.creator_user_id
LEFT JOIN provider p ON p.id = rmo.provider_id','raw_material_order','POST'),
	 ('TestInsert','/InsertSQL','INSERT INTO sql_queries','sql_queries','PUT'),
	 ('addEstablishment','/addEstablishment','insert into establishment','establishment','PUT'),
	 ('addProvider','/addProvider','insert into provider','provider','PUT'),
	 ('addRawMaterial','/addRawMaterial','insert into raw_material','raw_material','PUT'),
	 ('addRawMaterialByProvider','/addRawMaterialByProvider','insert into raw_material_by_provider','raw_material_by_provider','PUT'),
	 ('addFinishedProduct','/addFinishedProduct','insert into finished_product','finished_product','PUT');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addProductForSale','/addProductForSale','insert into product_for_sale','product_for_sale','PUT'),
	 ('listProductForSaleStoreOrder','/listProductForSaleStoreOrder','SELECT json_agg(
    json_build_object(
        ''id'', pfsso.id,
        ''name'', pfsso.name,
        ''comment'', pfsso.comment,
        ''finalAmount'', pfsso.final_amount,
        ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
        ''creationDate'', pfsso.creation_date,
        ''establishment'', json_build_object(
        	''name'', e."name",
            ''identifier'', e."name",
            ''id'', e.id,
            ''address'', e.address
        ),
        ''storeStatus'', json_build_object(
            ''identifier'', s.name,
            ''id'', s.id,
            ''bg_color'', s.bg_color,
            ''color'', s.color
        ),
        ''factoryStatus'', json_build_object(
            ''identifier'', s2.name,
            ''id'', s2.id,
            ''bg_color'', s2.bg_color,
            ''color'', s2.color
        ),
        ''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email,
            ''id'', u.id
        )
    )
    ORDER BY pfsso.creation_date DESC
) AS json_result
from product_for_sale_store_order pfsso
left join establishment e on e.id = pfsso.establishment_id
left join status s on s.id = pfsso.store_status_id
left join status s2 on s2.id = pfsso.factory_status_id
left join "user" u on u.id = pfsso.creator_user_id','product_for_sale_store_order','POST'),
	 ('manageProductForSaleStoreOrder','/manageProductForSaleStoreOrder','call manage_product_for_sale_order_state($1::uuid, $2, $3::uuid)','product_for_sale_store_order','PATCH'),
	 ('addManyProductForSale','/addManyProductForSale','call insert_multi_product_for_sale($1,$2::uuid)','product_for_sale','PATCH'),
	 ('updateProductForSale','/updateProductForSale','update product_for_sale 
set price = $1, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $2','product_for_sale','PATCH'),
	 ('deleteProductForSale','/deleteProductForSale','update product_for_sale 
set status_id = 51, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','product_for_sale','PATCH'),
	 ('retriveProductForSaleInventoryActions','/retriveProductForSaleInventoryActions','SELECT json_agg(
    json_build_object(
    	''id'', iea.id,
    	''creationDate'', iea.creation_date,
    	''reason'', iea."comment",
    	''element'', json_build_object(
    		''name'', fp."name"
    	),
    	''measure'', json_build_object(
            ''identifier'', m.name,
            ''unitBase'', json_build_object(
                ''quantity'', m.unit_base_quantity
            )
        ),
    	''quantity'', iea.quantity,
    	''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email
        ),
        ''actionType'', json_build_object(
        	''color'', at.color,
        	''action'', at.action,
            ''name'', at."name"
        )
    )
) as json_result
from inventory_element_action iea
left join inventory_element ie on ie.id = iea.source_inventory_element_id
left join inventory i on i.id = ie.inventory_id
left join measure m on m.id = iea.measure_id 
left join "user" u on u.id = iea.creator_user_id
left join action_type at on at.id = iea.action_type_id 
join product_for_sale pfs on ie.element_fk = pfs.id
left JOIN finished_product fp ON fp.id = pfs.finished_product_id','inventory_element_action','POST'),
	 ('updateEstablishment','/updateEstablishment','update establishment
set name = $1,
address = $2,
description = $3,
receive_pending_orders_enabled = $4,
establishment_type_id = $5,
updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $6','establishment','PATCH'),
	 ('retriveRawMaterialInventoryActions','/retriveRawMaterialInventoryActions','SELECT json_agg(
    json_build_object(
    	''id'', iea.id,
    	''creationDate'', iea.creation_date,
    	''reason'', iea."comment",
    	''element'', json_build_object(
    		''name'', rm."name"
    	),
    	''measure'', json_build_object(
            ''identifier'', m.name,
            ''unitBase'', json_build_object(
                ''quantity'', m.unit_base_quantity
            )
        ),
    	''quantity'', iea.quantity,
    	''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email
        ),
        ''actionType'', json_build_object(
        	''color'', at.color,
        	''action'', at.action,
            ''name'', at."name"
        )
    )
) as json_result
from inventory_element_action iea
left join inventory_element ie on ie.id = iea.source_inventory_element_id
left join inventory i on i.id = ie.inventory_id
left join measure m on m.id = iea.measure_id 
left join "user" u on u.id = iea.creator_user_id
left join action_type at on at.id = iea.action_type_id 
join raw_material rm on ie.element_fk = rm.id','inventory_element_action','POST'),
	 ('deleteEstablishment','/deleteEstablishment','update establishment
set status_id = 29, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','establishment','PATCH');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateProvider','/updateProvider','update provider
set name = $1, phone = $2, description = $3, company = $4, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $5','provider','PATCH'),
	 ('deleteProvider','/deleteProvider','update provider
set status_id = 31, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','provider','PATCH'),
	 ('deleteRawMaterial','/deleteRawMaterial','update raw_material
set status_id = 33, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','raw_material','PATCH'),
	 ('UpdateRawMaterial','/UpdateRawMaterial','update raw_material
set name = $1, description = $2, photo = $3, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $4','raw_material','PATCH'),
	 ('deleteRawMaterialByProvider','/deleteRawMaterialByProvider','UPDATE raw_material_by_provider
SET status_id = 35, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $1','raw_material_by_provider','PATCH'),
	 ('updateRawMaterialByProvider','/updateRawMaterialByProvider','UPDATE raw_material_by_provider
SET price= $1::numeric, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $2','raw_material_by_provider','PATCH'),
	 ('updateFinishedProduct','/updateFinishedProduct','UPDATE finished_product
SET name=$1, description=$2, photo=$3, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $4','finished_product','PATCH'),
	 ('deleteFinishedProduct','/deleteFinishedProduct','UPDATE finished_product
SET status_id=37, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $1','finished_product','PATCH'),
	 ('addRawMaterialOrder','/addRawMaterialOrder','call public.create_raw_material_order_with_elements($1,$2)','raw_material_order','PATCH'),
	 ('updateRawMaterialOrderElements','/updateRawMaterialOrderElements','call update_raw_material_order_elements($1::uuid,$2,$3)','raw_material_order','PATCH');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateRawMaterialOrder','/updateRawMaterialOrder','update raw_material_order 
set name = $1, payment_type_id = $2, description = $3, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $4','raw_material_order','PATCH'),
	 ('deleteRawMaterialOrder','/deleteRawMaterialOrder','update raw_material_order 
set status_id = 43, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','raw_material_order','PATCH'),
	 ('addRawMaterialOrderPaymentHistory','/addRawMaterialOrderPaymentHistory','call add_raw_material_order_payment($1::uuid, $2::numeric, $3)','raw_material_order','PATCH'),
	 ('verifyRawMaterialOrder','/verifyRawMaterialOrder','call verify_raw_material_order($1::uuid,$2,$3,$4::uuid)','raw_material_order','PATCH'),
	 ('addRemoveInventoryElement','/addRemoveInventoryElement','call add_remove_inventory_element($1, $2, $3::uuid, $4, $5, $6::uuid, $7, $8)','inventory_element','PATCH'),
	 ('multiAddRemoveInventoryElement','/multiAddRemoveInventoryElement','call multi_add_remove_inventory_elements($1)','inventory_element','PATCH'),
	 ('addProductForSaleStoreOrder','/addProductForSaleStoreOrder','call create_product_for_sale_order_with_elements($1,$2)','product_for_sale_store_order','PATCH'),
	 ('deleteUser','/deleteUser','update "user"
set status_id = 8
where id = $1::uuid','user','PATCH'),
	 ('retrieveProductForSaleInventory','/retrieveProductForSaleInventory','WITH inventory_elements_ordered AS (
    SELECT
        ie.inventory_id,
        ie.id AS ie_id,
        ie.element_type,
        ie.quantity,
        pfs.id AS pfs_id,
        pfs.price AS pfs_price,
        pfs.creation_date AS pfs_creation_date,
        fp.id AS fp_id,
        fp.name AS fp_name,
        fp.photo AS fp_photo,
        m.id AS m_id,
        m.name AS m_name,
        m.unit_base_quantity,
        ub.id AS ub_id,
        ub.name AS ub_name,
        sie.id AS sie_id,
        sie.name AS sie_name,
        srm.id AS srm_id,
        srm.name AS srm_name
    FROM inventory_element ie
    JOIN product_for_sale pfs ON ie.element_fk = pfs.id
    LEFT JOIN finished_product fp ON fp.id = pfs.finished_product_id
    LEFT JOIN status sie ON sie.id = pfs.status_id
    LEFT JOIN measure m ON m.id = ie.measure_id
    LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
    LEFT JOIN status srm ON srm.id = fp.status_id
    WHERE ie.element_type = ''product_for_sale''
      AND sie."name" = ''Activo''
)
SELECT json_build_object(
    ''id'', i.id,
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''establishment'', json_build_object(
        ''id'', e.id,
        ''name'', e."name"
    ),
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', oe.ie_id,
                ''element_type'', oe.element_type,
                ''quantity'', oe.quantity,
                ''status'', json_build_object(
                    ''identifier'', oe.sie_name,
                    ''id'', oe.sie_id
                ),
                ''measure'', json_build_object(
                    ''id'', oe.m_id,
                    ''identifier'', oe.m_name,
                    ''unitBase'', json_build_object(
                        ''quantity'', oe.unit_base_quantity,
                        ''name'', oe.ub_name,
                        ''id'', oe.ub_id
                    )
                ),
                ''productForSale'', json_build_object(
                    ''id'', oe.pfs_id,
                    ''price'', oe.pfs_price,
                    ''finishedProduct'', json_build_object(
                        ''id'', oe.fp_id,
                        ''name'', oe.fp_name,
                        ''photo'', oe.fp_photo,
                        ''status'', json_build_object(
                            ''id'', oe.srm_id,
                            ''identifier'', oe.srm_name
                        ),
                        ''measure'', json_build_object(
                            ''identifier'', oe.ub_name
                        )
                    )
                )
            ) ORDER BY oe.pfs_creation_date asc
        )
        FROM inventory_elements_ordered oe
        WHERE oe.inventory_id = i.id
    )
) AS json_result
FROM inventory i
LEFT JOIN establishment e ON e.id::text = i.unit_name','inventory','POST'),
	 ('returnPFSToWarehouse','/returnPFSToWarehouse','call return_pfs_to_warehouse($1, $2, $3::uuid, $4, $5, $6::uuid, $7)','inventory_element','PATCH');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('listShopSaleSummary','/listShopSaleSummary','SELECT json_agg(
    json_build_object(
        ''id'', ss.id,
        ''total'', ss.total,
        ''totalDiscount'', ss.total_discount,
        ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
        ''status'', json_build_object(''id'', s.id),
        ''establishment'', json_build_object(
            ''id'', e.id,
            ''name'', e.name
        )
    )
) AS json_result
from shop_sale ss
left join status s on ss.status_id = s.id
left join establishment e on ss.establishment_id = e.id','shop_sale','POST'),
	 ('getProductForSaleStoreOrder','/getProductForSaleStoreOrder','SELECT json_build_object(
    ''id'', pfsso.id,
    ''name'', pfsso.name,
    ''comment'', pfsso.comment,
    ''finalAmount'', pfsso.final_amount,
    ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
    ''creationDate'', pfsso.creation_date,
    ''establishment'', json_build_object(
        ''identifier'', e."name",
		''name'', e."name",
        ''id'', e.id,
        ''address'', e.address,
		''receivePendingOrdersEnabled'', e.receive_pending_orders_enabled
    ),
    ''storeStatus'', json_build_object(
        ''identifier'', s.name,
        ''id'', s.id
    ),
    ''factoryStatus'', json_build_object(
        ''identifier'', s2.name,
        ''id'', s2.id
    ),
    ''creatorUser'', json_build_object(
        ''name'', u.username,
        ''email'', u.email,
        ''id'', u.id
    ),
    ''productForSaleStoreOrderElements'', (
	    SELECT json_agg(
		    json_build_object(
		    	''id'', pfssoe.id,
		    	''price'', pfssoe.price,
		    	''quantity'', pfssoe.quantity,
		    	''totalPrice'', pfssoe.total_price,
		    	''date'', pfssoe."date",
		    	''measure'', json_build_object(
		    		''id'', m5.id,
	                ''identifier'', m5.name
	            ),
		        ''productForSale'', json_build_object(
		        	''id'', pfs.id,
			        ''creationDate'', pfs.creation_date,
				    ''updatedDate'', pfs.updated_date,
			        ''price'', pfs.price,
			        ''finishedProduct'', json_build_object(
			            ''id'', fp.id,
			            ''name'', fp.name,
			            ''photo'', fp.photo,
			            ''description'', fp.description,
			            ''measure'', json_build_object(
			                ''identifier'', ub.name,
			                ''type'', ub."type"
			            )
			        ),
			        ''status'', json_build_object(
			            ''name'', s3.name,
			            ''type'', s3."type"
			        ),
			        ''establishment'', json_build_object(
			            ''id'', e3.id,
			            ''name'', e3.name
			        )
		        )
		    )
		)
		from product_for_sale_store_order_element pfssoe
		left join product_for_sale pfs on pfs.id = pfssoe.product_for_sale_id
		LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
		LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
		LEFT JOIN establishment e3 ON e3.id = pfs.establishment_id
		LEFT JOIN status s3 ON s3.id = pfs.status_id
		left join measure m5 on m5.id = pfssoe.measure_id
		WHERE pfssoe.pfsso_id = pfsso.id
	)
) as json_result
from product_for_sale_store_order pfsso 
left join establishment e on e.id = pfsso.establishment_id
left join status s on s.id = pfsso.store_status_id
left join status s2 on s2.id = pfsso.factory_status_id
left join "user" u on u.id = pfsso.creator_user_id','product_for_sale_store_order','POST'),
	 ('confirmAndReceivePFSOrder','/confirmAndReceivePFSOrder','call confirm_and_receive_pfs_order($1::uuid, $2::uuid)','product_for_sale_store_order','PATCH'),
	 ('getRawMaterialByProvider','/getRawMaterialByProvider','SELECT json_build_object(
        ''id'', rmbp.id,
        ''rawMaterialByProviderTypeId'', rmbp.raw_material_by_provider_type_id,
    ''price'', rmbp.price,
    ''creationDate'', rmbp.creation_date,
    ''updatedDate'', coalesce(rmbp.updated_date, rmbp.creation_date),
    ''rawMaterialBase'', json_build_object(
    	''id'', rm.id,
        ''name'', rm.name,
        ''description'', rm.description,
        ''photo'', rm.photo,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        )
    ),
    ''status'', json_build_object(
    	''id'', s.id,
        ''identifier'', s.name,
        ''type'', s."type"
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    ),
    ''provider'', json_build_object(
    	''id'', p.id,
        ''name'', p.name,
        ''email'', p.email
    )
) as json_result
FROM raw_material_by_provider rmbp
LEFT JOIN raw_material rm ON rmbp.raw_material_base_id = rm.id
LEFT JOIN unit_base ub ON rm.unit_base_id = ub.id
LEFT JOIN provider p ON p.id = rmbp.provider_id
LEFT JOIN status s ON s.id = rmbp.status_id
LEFT JOIN "user" u ON u.id = rmbp.creator_user_id','raw_material_by_provider','POST'),
	 ('retriveFinishedProductInventoryActions','/retriveFinishedProductInventoryActions','SELECT json_agg(
    json_build_object(
    	''id'', iea.id,
    	''creationDate'', iea.creation_date,
    	''reason'', iea."comment",
    	''element'', json_build_object(
    		''name'', fp."name",
    		''finishedProductTypeId'', fp.finished_product_type_id
    	),
    	''measure'', json_build_object(
            ''identifier'', m.name,
            ''unitBase'', json_build_object(
                ''quantity'', m.unit_base_quantity
            )
        ),
    	''quantity'', iea.quantity,
    	''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email
        ),
        ''actionType'', json_build_object(
        	''color'', at.color,
        	''action'', at.action,
            ''name'', at."name"
        )
    )
) as json_result
from inventory_element_action iea
left join inventory_element ie on ie.id = iea.source_inventory_element_id
left join inventory i on i.id = ie.inventory_id
left join measure m on m.id = iea.measure_id 
left join "user" u on u.id = iea.creator_user_id
left join action_type at on at.id = iea.action_type_id 
join finished_product fp on ie.element_fk = fp.id','inventory_element_action','POST'),
	 ('retrieveProductsForSale','/retrieveProductsForSale','WITH products_ordered AS (
    SELECT pfs1.id, pfs1.creation_date, pfs1.updated_date, pfs1.price,
           fp.id AS fp_id, fp.name AS fp_name, fp.photo, fp.description,
           ub.name AS ub_name, ub."type" AS ub_type,
           s.name AS s_name, s.id as status_id, s."type" AS s_type,
           e.id AS establishment_id, e.name AS e_name
    FROM product_for_sale pfs1
    LEFT JOIN finished_product fp ON pfs1.finished_product_id = fp.id
    LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
    LEFT JOIN establishment e ON e.id = pfs1.establishment_id
    LEFT JOIN status s ON s.id = pfs1.status_id
    ORDER BY pfs1.creation_date ASC
)
SELECT json_agg(
    json_build_object(
        ''id'', pfs.id,
        ''creationDate'', pfs.creation_date,
        ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
        ''price'', pfs.price,
        ''finishedProduct'', json_build_object(
            ''id'', pfs.fp_id,
            ''name'', pfs.fp_name,
            ''photo'', pfs.photo,
            ''description'', pfs.description,
            ''measure'', json_build_object(
                ''identifier'', pfs.ub_name,
                ''type'', pfs.ub_type
            )
        ),
        ''status'', json_build_object(
        	''id'', pfs.status_id,
            ''name'', pfs.s_name,
            ''type'', pfs.s_type
        ),
        ''establishment'', json_build_object(
            ''id'', pfs.establishment_id,
            ''name'', pfs.e_name
        )
    )
) AS json_result
FROM products_ordered pfs','product_for_sale','POST'),
	 ('retrieveAllProductForSaleInventory','/retrieveAllProductForSaleInventory','WITH inventory_elements_ordered AS (
    SELECT
        ie.inventory_id,
        ie.id AS ie_id,
        ie.element_type,
        ie.quantity,
        pfs.id AS pfs_id,
        pfs.price AS pfs_price,
        pfs.creation_date AS pfs_creation_date,
        fp.id AS fp_id,
        fp.name AS fp_name,
        fp.photo AS fp_photo,
        m.id AS m_id,
        m.name AS m_name,
        m.unit_base_quantity,
        ub.id AS ub_id,
        ub.name AS ub_name,
        sie.id AS sie_id,
        sie.name AS sie_name,
        srm.id AS srm_id,
        srm.name AS srm_name
    FROM inventory_element ie
    JOIN product_for_sale pfs ON ie.element_fk = pfs.id
    LEFT JOIN finished_product fp ON fp.id = pfs.finished_product_id
    LEFT JOIN status sie ON sie.id = pfs.status_id
    LEFT JOIN measure m ON m.id = ie.measure_id
    LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
    LEFT JOIN status srm ON srm.id = fp.status_id
    WHERE ie.element_type = ''product_for_sale''
      AND sie."name" = ''Activo''
)
SELECT json_agg(
    json_build_object(
        ''id'', i.id,
        ''inventoryType'', i.inventory_type,
        ''unitName'', i.unit_name,
        ''creationDate'', i.creation_date,
        ''establishment'', json_build_object(
            ''id'', e.id,
            ''name'', e."name"
        ),
        ''inventoryElements'', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    ''id'', oe.ie_id,
                    ''element_type'', oe.element_type,
                    ''quantity'', oe.quantity,
                    ''status'', json_build_object(
                        ''identifier'', oe.sie_name,
                        ''id'', oe.sie_id
                    ),
                    ''measure'', json_build_object(
                        ''id'', oe.m_id,
                        ''identifier'', oe.m_name,
                        ''unitBase'', json_build_object(
                            ''quantity'', oe.unit_base_quantity,
                            ''name'', oe.ub_name,
                            ''id'', oe.ub_id
                        )
                    ),
                    ''productForSale'', json_build_object(
                        ''id'', oe.pfs_id,
                        ''price'', oe.pfs_price,
                        ''finishedProduct'', json_build_object(
                            ''id'', oe.fp_id,
                            ''name'', oe.fp_name,
                            ''photo'', oe.fp_photo,
                            ''status'', json_build_object(
                                ''id'', oe.srm_id,
                                ''identifier'', oe.srm_name
                            ),
                            ''measure'', json_build_object(
                                ''identifier'', oe.ub_name
                            )
                        )
                    )
                ) ORDER BY oe.pfs_creation_date ASC
            ), ''[]''::json)
            FROM inventory_elements_ordered oe
            WHERE oe.inventory_id = i.id
        )
    )
) AS json_result
FROM inventory i
INNER JOIN establishment e ON e.id::text = i.unit_name
','inventory','POST'),
	 ('updateStoreExpense','/updateStoreExpense','UPDATE store_expense
SET
    title        = $1::VARCHAR(40),
    comment      = $2::VARCHAR(100),
    total_amount = $3::NUMERIC(10,2),
    nit          = COALESCE(NULLIF($4, ''''), ''C/F'')::VARCHAR(10),
    supplier     = $5::VARCHAR(20),
    updated_date = NOW()
WHERE id = $6::UUID
RETURNING id','store_expense','PATCH'),
	 ('addStoreExpense','/addStoreExpense','INSERT INTO store_expense (title, comment, total_amount, nit, supplier, establishment_id, status_id, creator_user_id)
VALUES (
    $1::VARCHAR(40),
    $2::VARCHAR(100),
    $3::NUMERIC(10,2),
    COALESCE(NULLIF($4, ''''), ''C/F'')::VARCHAR(10),
    $5::VARCHAR(20),
    $6::UUID,
    58,
    $7::UUID
)
RETURNING id','store_expense','PATCH'),
	 ('getStoreExpense','/getStoreExpense','SELECT json_build_object(
	''id'', se.id,
	''title'', se.title,
	''totalAmount'', se.total_amount,
	''supplier'', se.supplier,
	''nit'', se.nit,
	''comment'', se.comment,
    ''updatedDate'', coalesce(se.updated_date, se.creation_date),
    ''creationDate'', se.creation_date,
	''status'', json_build_object(
            ''id'',         s.id,
            ''identifier'', s.name,
            ''bg_color'',   s.bg_color,
            ''color'',      s.color
    ),
    ''establishment'', json_build_object(
        ''id'',   e.id,
        ''name'', e.name
    ),
    ''creatorUser'', json_build_object(
        ''id'',   u.id,
        ''name'', u.username
    )
) as json_result
FROM store_expense se
LEFT JOIN status       s ON s.id = se.status_id
LEFT JOIN establishment e ON e.id = se.establishment_id
LEFT JOIN "user"       u ON u.id  = se.creator_user_id','store_expense','POST');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('listStoreExpense','/listStoreExpense','SELECT json_agg(
    json_build_object(
        ''id'', se.id,
    	''title'', se.title,
		''totalAmount'', se.total_amount,
		''supplier'', se.supplier,
		''nit'', se.nit,
    	''updatedDate'', coalesce(se.updated_date, se.creation_date),
        ''status'', json_build_object(
	        ''id'',         s.id,
	        ''identifier'', s."name" ,
	        ''bg_color'',   s.bg_color,
	        ''color'',      s.color
    	)
    )
) AS json_result
FROM store_expense se
LEFT JOIN status      s ON s.id = se.status_id
LEFT JOIN establishment e ON e.id = se.establishment_id
LEFT JOIN "user"      u ON u.id  = se.creator_user_id','store_expense','POST'),
	 ('deleteStoreExpense','/deleteStoreExpense','UPDATE store_expense
SET
    status_id    = 59,
    updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $1::UUID
RETURNING id','store_expense','PATCH');

-- ============================================================
-- V2 shop sale queries (credit payment support)
-- ============================================================
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('registerShopV2','/registerShopV2','call register_shop_sale_with_elements_v2($1,$2,$3::uuid)','shop_sale','PATCH'),
	 ('registerShopV3','/registerShopV3','call register_shop_sale_with_elements_v3($1,$2,$3::uuid)','shop_sale','PATCH'),
	 ('addShopSalePaymentV2','/addShopSalePaymentV2','call add_shop_sale_payment($1::uuid,$2::numeric,$3::int)','shop_sale_payment','PATCH'),
	 ('addShopSalePaymentV3','/addShopSalePaymentV3','call add_shop_sale_payment_v2($1::uuid,$2::numeric,$3::int,$4)','shop_sale_payment','PATCH'),
	 ('getShopSalePaymentsV2','/getShopSalePaymentsV2','SELECT json_agg(
    json_build_object(
        ''id'', ssp.id,
        ''amount'', ssp.amount,
        ''date'', ssp.date,
        ''paymentTarget'', ssp.payment_target,
        ''paymentType'', json_build_object(
            ''id'', pt.id,
            ''identifier'', pt."name"
        )
    ) ORDER BY ssp.date ASC
) AS json_result
FROM shop_sale_payment ssp
LEFT JOIN payment_type pt ON pt.id = ssp.payment_type_id','shop_sale_payment','POST'),
	 ('addShopSalePaymentV4','/addShopSalePaymentV4','call add_shop_sale_payment_v3($1::uuid,$2::numeric,$3::int,$4,nullif($5::text,''''),nullif($6::text,'''')::timestamp)','shop_sale_payment','PATCH'),
	 ('getShopSalePaymentsV3','/getShopSalePaymentsV3','SELECT json_agg(
    json_build_object(
        ''id'', ssp.id,
        ''amount'', ssp.amount,
        ''date'', ssp.date,
        ''comment'', ssp."comment",
        ''paymentTarget'', ssp.payment_target,
        ''paymentType'', json_build_object(
            ''id'', pt.id,
            ''identifier'', pt."name"
        )
    ) ORDER BY ssp.date ASC
) AS json_result
FROM shop_sale_payment ssp
LEFT JOIN payment_type pt ON pt.id = ssp.payment_type_id','shop_sale_payment','POST'),
	 ('getShopSaleV2','/getShopSaleV2','select json_build_object(
    ''id'', ss.id,
    ''saleNumber'', ss.sale_number,
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
left join establishment e on ss.establishment_id = e.id','shop_sale','POST'),
	 ('listShopSaleV2','/listShopSaleV2','WITH items AS (
    SELECT
        sse.shop_sale_id,
        json_agg(json_build_object(
            ''id'', sse.id,
            ''productForSale'', json_build_object(
                ''id'', pfs.id,
                ''finishedProduct'', json_build_object(''id'', fp.id, ''name'', fp.name)
            )
        )) AS json_data
    FROM shop_sale_element sse
    LEFT JOIN product_for_sale pfs ON pfs.id = sse.product_for_sale_id
    LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
    GROUP BY sse.shop_sale_id
)
SELECT json_agg(
    json_build_object(
        ''id'', ss.id,
        ''saleNumber'', ss.sale_number,
        ''nameClient'', ss.name_client,
        ''nitClient'', ss.nit_client,
        ''nota'', ss.nota,
        ''total'', ss.total,
        ''delivery'', ss.delivery,
        ''pendingAmount'', ss.pending_amount,
        ''deliveryPendingAmount'', ss.delivery_pending_amount,
        ''updatedDate'', COALESCE(ss.updated_date, ss.creation_date),
        ''creationDate'', ss.creation_date,
        ''status'', json_build_object(
            ''identifier'', s.name, ''id'', s.id, ''bg_color'', s.bg_color, ''color'', s.color
        ),
        ''paymentType'', json_build_object(''id'', pt.id, ''identifier'', pt.name),
        ''deliveryPaymentType'', json_build_object(''id'', dpt.id, ''identifier'', dpt.name),
        ''paymentStatus'', json_build_object(
            ''id'', pst.id, ''identifier'', pst.name, ''bg_color'', pst.bg_color, ''color'', pst.color
        ),
        ''deliveryPaymentStatus'', json_build_object(
            ''id'', dpst.id, ''identifier'', dpst.name, ''bg_color'', dpst.bg_color, ''color'', dpst.color
        ),
        ''itemsList'', i.json_data
    )
) AS json_result
FROM shop_sale ss
LEFT JOIN status s ON ss.status_id = s.id
LEFT JOIN status pst ON ss.payment_status_id = pst.id
LEFT JOIN status dpst ON ss.delivery_payment_status_id = dpst.id
LEFT JOIN payment_type pt ON ss.payment_type_id = pt.id
LEFT JOIN payment_type dpt ON ss.delivery_payment_type_id = dpt.id
LEFT JOIN items i ON i.shop_sale_id = ss.id','shop_sale','POST');

-- ============================================================
-- V2 cash closing queries
-- ============================================================
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getStoreCashClosingExpenses','/getStoreCashClosingExpenses','SELECT json_agg(json_build_object(
	''id'', se2.id,
	''title'', se2.title,
	''totalAmount'', se2.total_amount,
	''comment'', se2.comment,
	''supplier'', se2.supplier,
	''nit'', se2.nit,
	''creationDate'', se2.creation_date,
	''status'', json_build_object(
		''id'', s2.id,
		''identifier'', s2."name"
	)
)) AS json_result
FROM establishment e2
LEFT JOIN store_expense se2 ON se2.establishment_id = e2.id
	AND se2.status_id = 58
	AND ((SELECT max(cc.creation_date) FROM cash_closing cc WHERE cc.establishment_id = e2.id) IS NULL
	     OR se2.creation_date >= (SELECT max(cc.creation_date) FROM cash_closing cc WHERE cc.establishment_id = e2.id))
LEFT JOIN status s2 ON s2.id = se2.status_id','store_expense','POST');

-- ============================================================
-- V2 image queries (thumbnail support)
-- Copias aditivas de las queries de imagen agregando el campo `thumb`.
-- NO reemplazan a las originales; conviven en paralelo.
--   * raw_material / finished_product: columna propia `thumb`.
--   * product_for_sale: hereda `fp.thumb` (sin columna propia).
-- ============================================================
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addRawMaterialV2','/addRawMaterialV2','insert into raw_material','raw_material','PUT'),
	 ('UpdateRawMaterialV2','/UpdateRawMaterialV2','update raw_material
set name = $1, description = $2, photo = $3, thumb = $4, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $5','raw_material','PATCH'),
	 ('getRawMaterialV2','/getRawMaterialV2','select json_build_object(
    ''id'', rm.id,
    ''rm_id'', rm.id,
    ''name'', rm.name,
    ''photo'', rm.photo,
    ''thumb'', rm.thumb,
    ''description'', rm.description,
    ''creationDate'', rm.creation_date,
    ''updatedDate'', coalesce(rm.updated_date, rm.creation_date),
    ''measure'', json_build_object(
    	''id'', ub.id,
        ''identifier'', ub.name,
        ''type'', ub."type"
    ),
    ''status'', json_build_object(
    	''id'', s.id,
        ''identifier'', s.name,
        ''type'', s."type"
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM raw_material rm
LEFT JOIN unit_base ub ON ub.id = rm.unit_base_id
LEFT JOIN status s ON s.id = rm.status_id
LEFT JOIN "user" u ON u.id = rm.creator_user_id','raw_material','POST'),
	 ('retrieveRawMaterialV2','/retrieveRawMaterialV2','SELECT json_agg(
    json_build_object(
        ''id'', rm.id,
        ''rm_id'', rm.id,
        ''name'', rm.name,
        ''photo'', rm.photo,
        ''thumb'', rm.thumb,
	    ''description'', rm.description,
	    ''creationDate'', rm.creation_date,
	    ''updatedDate'', coalesce(rm.updated_date, rm.creation_date),
        ''measure'', json_build_object(
        	''id'', ub.id,
            ''identifier'', ub.name,
            ''type'', ub."type"
        ),
        ''status'', json_build_object(
        	''id'', s.id,
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
) as json_result
FROM raw_material rm
LEFT JOIN unit_base ub ON ub.id = rm.unit_base_id
LEFT JOIN status s ON s.id = rm.status_id
LEFT JOIN "user" u ON u.id = rm.creator_user_id','raw_material','POST'),
	 ('addFinishedProductV2','/addFinishedProductV2','insert into finished_product','finished_product','PUT'),
	 ('updateFinishedProductV2','/updateFinishedProductV2','UPDATE finished_product
SET name=$1, description=$2, photo=$3, thumb=$4, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id=$5','finished_product','PATCH'),
	 ('getFinishedProductV2','/getFinishedProductV2','SELECT json_build_object(
    ''id'', fp.id,
    ''name'', fp.name,
    ''description'', fp.description,
    ''photo'', fp.photo,
    ''thumb'', fp.thumb,
    ''creationDate'', fp.creation_date,
    ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
    ''finishedProductTypeId'', fp.finished_product_type_id,
    ''measure'', json_build_object(
        ''identifier'', ub.name,
        ''type'', ub."type"
    ),
    ''status'', json_build_object(
    	''id'', s.id,
    	''identifier'', s.name,
        ''name'', s.name,
        ''type'', s."type"
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM finished_product fp
LEFT JOIN unit_base ub ON ub.id = fp.unit_base_id
LEFT JOIN status s ON s.id = fp.status_id
LEFT JOIN "user" u ON u.id = fp.creator_user_id','finished_product','POST'),
	 ('retrieveFinishedProductV2','/retrieveFinishedProductV2','SELECT json_agg(
    json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''description'', fp.description,
        ''photo'', fp.photo,
        ''thumb'', fp.thumb,
        ''creationDate'', fp.creation_date,
        ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
        ''finishedProductTypeId'', fp.finished_product_type_id,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        ),
        ''status'', json_build_object(
        	''id'', s.id,
        	''identifier'', s.name,
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
) as json_result
FROM finished_product fp
LEFT JOIN unit_base ub ON ub.id = fp.unit_base_id
LEFT JOIN status s ON s.id = fp.status_id
LEFT JOIN "user" u ON u.id = fp.creator_user_id','finished_product','POST'),
	 ('getProductForSaleV2','/getProductForSaleV2','SELECT json_build_object(
    ''id'', pfs.id,
    ''price'', pfs.price,
    ''creationDate'', pfs.creation_date,
    ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
    ''finishedProduct'', json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''photo'', fp.photo,
        ''thumb'', fp.thumb,
        ''description'', fp.description,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        )
    ),
    ''status'', json_build_object(
        ''name'', s.name,
        ''identifier'', s.name,
        ''type'', s."type"
    ),
    ''establishment'', json_build_object(
        ''id'', e.id,
        ''name'', e.name
    ),
    ''creatorUser'', json_build_object(
        ''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM product_for_sale pfs
LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
LEFT JOIN establishment e ON e.id = pfs.establishment_id
LEFT JOIN status s ON s.id = pfs.status_id
left join "user" u on u.id = pfs.creator_user_id','product_for_sale','POST'),
	 ('retrieveProductsForSaleV2','/retrieveProductsForSaleV2','WITH products_ordered AS (
    SELECT pfs1.id, pfs1.creation_date, pfs1.updated_date, pfs1.price,
           fp.id AS fp_id, fp.name AS fp_name, fp.photo, fp.thumb, fp.description,
           ub.name AS ub_name, ub."type" AS ub_type,
           s.name AS s_name, s.id as status_id, s."type" AS s_type,
           e.id AS establishment_id, e.name AS e_name
    FROM product_for_sale pfs1
    LEFT JOIN finished_product fp ON pfs1.finished_product_id = fp.id
    LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
    LEFT JOIN establishment e ON e.id = pfs1.establishment_id
    LEFT JOIN status s ON s.id = pfs1.status_id
    ORDER BY pfs1.creation_date ASC
)
SELECT json_agg(
    json_build_object(
        ''id'', pfs.id,
        ''creationDate'', pfs.creation_date,
        ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
        ''price'', pfs.price,
        ''finishedProduct'', json_build_object(
            ''id'', pfs.fp_id,
            ''name'', pfs.fp_name,
            ''photo'', pfs.photo,
            ''thumb'', pfs.thumb,
            ''description'', pfs.description,
            ''measure'', json_build_object(
                ''identifier'', pfs.ub_name,
                ''type'', pfs.ub_type
            )
        ),
        ''status'', json_build_object(
        	''id'', pfs.status_id,
            ''name'', pfs.s_name,
            ''type'', pfs.s_type
        ),
        ''establishment'', json_build_object(
            ''id'', pfs.establishment_id,
            ''name'', pfs.e_name
        )
    )
) AS json_result
FROM products_ordered pfs','product_for_sale','POST');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveRawMaterialV3','/retrieveRawMaterialV3','SELECT json_agg(
    json_build_object(
        ''id'', rm.id,
        ''rm_id'', rm.id,
        ''name'', rm.name,
        ''photo'', rm.photo,
        ''thumb'', rm.thumb,
	    ''description'', rm.description,
	    ''creationDate'', rm.creation_date,
	    ''updatedDate'', coalesce(rm.updated_date, rm.creation_date),
        ''sortOrder'', rm.sort_order,
        ''measure'', json_build_object(
        	''id'', ub.id,
            ''identifier'', ub.name,
            ''type'', ub."type"
        ),
        ''status'', json_build_object(
        	''id'', s.id,
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
    ORDER BY rm.sort_order NULLS LAST, rm.creation_date
) as json_result
FROM raw_material rm
LEFT JOIN unit_base ub ON ub.id = rm.unit_base_id
LEFT JOIN status s ON s.id = rm.status_id
LEFT JOIN "user" u ON u.id = rm.creator_user_id','raw_material','POST'),
	 ('retrieveRawMaterialByProviderV2','/retrieveRawMaterialByProviderV2','SELECT json_agg(
    json_build_object(
        ''id'', rmbp.id,
        ''rawMaterialByProviderTypeId'', rmbp.raw_material_by_provider_type_id,
        ''price'', rmbp.price,
        ''updatedDate'', coalesce(rmbp.updated_date, rmbp.creation_date),
        ''creationDate'', rmbp.creation_date,
        ''sortOrder'', rmbp.sort_order,
        ''rawMaterialBase'', json_build_object(
        	''id'', rm.id,
            ''name'', rm.name,
            ''description'', rm.description,
            ''photo'', rm.photo,
            ''measure'', json_build_object(
                ''identifier'', ub.name,
                ''type'', ub."type"
            )
        ),
        ''status'', json_build_object(
        	''id'', s.id,
            ''identifier'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        ),
        ''provider'', json_build_object(
        	''id'', p.id,
            ''name'', p.name,
            ''email'', p.email
        )
    )
    ORDER BY rmbp.sort_order NULLS LAST, rmbp.creation_date
) as json_result
FROM raw_material_by_provider rmbp
LEFT JOIN raw_material rm ON rmbp.raw_material_base_id = rm.id
LEFT JOIN unit_base ub ON rm.unit_base_id = ub.id
LEFT JOIN provider p ON p.id = rmbp.provider_id
LEFT JOIN status s ON s.id = rmbp.status_id
LEFT JOIN "user" u ON u.id = rmbp.creator_user_id','raw_material_by_provider','POST'),
	 ('retrieveFinishedProductV3','/retrieveFinishedProductV3','SELECT json_agg(
    json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''description'', fp.description,
        ''photo'', fp.photo,
        ''thumb'', fp.thumb,
        ''creationDate'', fp.creation_date,
        ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
        ''finishedProductTypeId'', fp.finished_product_type_id,
        ''sortOrder'', fp.sort_order,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        ),
        ''status'', json_build_object(
        	''id'', s.id,
        	''identifier'', s.name,
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
    ORDER BY fp.sort_order NULLS LAST, fp.creation_date
) as json_result
FROM finished_product fp
LEFT JOIN unit_base ub ON ub.id = fp.unit_base_id
LEFT JOIN status s ON s.id = fp.status_id
LEFT JOIN "user" u ON u.id = fp.creator_user_id','finished_product','POST'),
	 ('retrieveProductsForSaleV3','/retrieveProductsForSaleV3','WITH products_ordered AS (
    SELECT pfs1.id, pfs1.creation_date, pfs1.updated_date, pfs1.price, pfs1.sort_order,
           fp.id AS fp_id, fp.name AS fp_name, fp.photo, fp.thumb, fp.description,
           ub.name AS ub_name, ub."type" AS ub_type,
           s.name AS s_name, s.id as status_id, s."type" AS s_type,
           e.id AS establishment_id, e.name AS e_name
    FROM product_for_sale pfs1
    LEFT JOIN finished_product fp ON pfs1.finished_product_id = fp.id
    LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
    LEFT JOIN establishment e ON e.id = pfs1.establishment_id
    LEFT JOIN status s ON s.id = pfs1.status_id
)
SELECT json_agg(
    json_build_object(
        ''id'', pfs.id,
        ''creationDate'', pfs.creation_date,
        ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
        ''price'', pfs.price,
        ''sortOrder'', pfs.sort_order,
        ''finishedProduct'', json_build_object(
            ''id'', pfs.fp_id,
            ''name'', pfs.fp_name,
            ''photo'', pfs.photo,
            ''thumb'', pfs.thumb,
            ''description'', pfs.description,
            ''measure'', json_build_object(
                ''identifier'', pfs.ub_name,
                ''type'', pfs.ub_type
            )
        ),
        ''status'', json_build_object(
        	''id'', pfs.status_id,
            ''name'', pfs.s_name,
            ''type'', pfs.s_type
        ),
        ''establishment'', json_build_object(
            ''id'', pfs.establishment_id,
            ''name'', pfs.e_name
        )
    )
    ORDER BY pfs.sort_order NULLS LAST, pfs.creation_date
) AS json_result
FROM products_ordered pfs','product_for_sale','POST'),
	 ('updateFinishedProductSortOrder','/updateFinishedProductSortOrder','UPDATE finished_product AS fp
SET sort_order = v.sort_order
FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, sort_order int)
WHERE fp.id = v.id','finished_product','PATCH'),
	 ('updateProductForSaleSortOrder','/updateProductForSaleSortOrder','UPDATE product_for_sale AS pfs
SET sort_order = v.sort_order
FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, sort_order int)
WHERE pfs.id = v.id','product_for_sale','PATCH'),
	 ('updateRawMaterialSortOrder','/updateRawMaterialSortOrder','UPDATE raw_material AS rm
SET sort_order = v.sort_order
FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, sort_order int)
WHERE rm.id = v.id','raw_material','PATCH'),
	 ('updateRawMaterialByProviderSortOrder','/updateRawMaterialByProviderSortOrder','UPDATE raw_material_by_provider AS rmbp
SET sort_order = v.sort_order
FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, sort_order int)
WHERE rmbp.id = v.id','raw_material_by_provider','PATCH');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveFinishedProductInventoryV2','/retrieveFinishedProductInventoryV2','SELECT json_build_object(
    ''id'', i.id,
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''creationDate'', ie.creation_date,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''finishedProduct'', json_build_object(
                    ''id'', fp.id,
                    ''name'', fp.name,
                    ''photo'', fp.photo,
                    ''finishedProductTypeId'', fp.finished_product_type_id,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub2.name
                    )
                )
            )
            ORDER BY fp.sort_order NULLS LAST, fp.creation_date
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON sie.id = ie.status_id
        LEFT JOIN measure m ON m.id = ie.measure_id
        LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
        left JOIN finished_product fp ON fp.id = ie.element_fk
        left join unit_base ub2 on ub2.id = fp.unit_base_id
        LEFT JOIN status srm ON srm.id = fp.status_id
        WHERE ie.element_type = ''finished_product''
          AND ie.inventory_id = i.id
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''finished_product''','inventory','POST'),
	 ('retrieveRawMaterialInventoryV2','/retrieveRawMaterialInventoryV2','SELECT json_build_object(
    ''id'', i.id,
    ''name'', i."name",
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''updatedDate'', i.updated_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''rawMaterialBase'', json_build_object(
                    ''id'', rm.id,
                    ''name'', rm.name,
                    ''photo'', rm.photo,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub.name
                    )
                )
            )
            ORDER BY rm.sort_order NULLS LAST, rm.creation_date
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON ie.status_id = sie.id
        LEFT JOIN measure m ON ie.measure_id = m.id
        LEFT JOIN unit_base ub ON m.unit_base_id = ub.id
        JOIN raw_material rm ON ie.element_fk = rm.id
        left join unit_base ub2 on ub2.id = rm.unit_base_id
        LEFT JOIN status srm ON srm.id = rm.status_id
        WHERE ie.element_type = ''raw_material''
          AND ie.inventory_id = i.id
    )
) as json_result
FROM inventory i
where i.inventory_type = ''raw_material''','inventory','POST'),
	 ('retrievePackagingMaterialInventoryV2','/retrievePackagingMaterialInventoryV2','SELECT json_build_object(
    ''id'', i.id,
    ''name'', i."name",
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''updatedDate'', i.updated_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''rawMaterialBase'', json_build_object(
                    ''id'', rm.id,
                    ''name'', rm.name,
                    ''photo'', rm.photo,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub.name
                    )
                )
            )
            ORDER BY rm.sort_order NULLS LAST, rm.creation_date
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON ie.status_id = sie.id
        LEFT JOIN measure m ON ie.measure_id = m.id
        LEFT JOIN unit_base ub ON m.unit_base_id = ub.id
        JOIN raw_material rm ON ie.element_fk = rm.id
        LEFT JOIN unit_base ub2 ON ub2.id = rm.unit_base_id
        LEFT JOIN status srm ON srm.id = rm.status_id
        WHERE ie.element_type = ''packaging_material''
          AND ie.inventory_id = i.id
          AND EXISTS (
              SELECT 1 FROM raw_material_by_provider rmbp
              WHERE rmbp.raw_material_base_id = rm.id
                AND rmbp.raw_material_by_provider_type_id = 2
                AND rmbp.status_id <> 35
          )
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''packaging_material''','inventory','POST'),
	 ('retrieveProductForSaleInventoryV2','/retrieveProductForSaleInventoryV2','WITH inventory_elements_ordered AS (
    SELECT
        ie.inventory_id,
        ie.id AS ie_id,
        ie.element_type,
        ie.quantity,
        pfs.id AS pfs_id,
        pfs.price AS pfs_price,
        pfs.creation_date AS pfs_creation_date,
        pfs.sort_order AS pfs_sort_order,
        fp.id AS fp_id,
        fp.name AS fp_name,
        fp.photo AS fp_photo,
        m.id AS m_id,
        m.name AS m_name,
        m.unit_base_quantity,
        ub.id AS ub_id,
        ub.name AS ub_name,
        sie.id AS sie_id,
        sie.name AS sie_name,
        srm.id AS srm_id,
        srm.name AS srm_name
    FROM inventory_element ie
    JOIN product_for_sale pfs ON ie.element_fk = pfs.id
    LEFT JOIN finished_product fp ON fp.id = pfs.finished_product_id
    LEFT JOIN status sie ON sie.id = pfs.status_id
    LEFT JOIN measure m ON m.id = ie.measure_id
    LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
    LEFT JOIN status srm ON srm.id = fp.status_id
    WHERE ie.element_type = ''product_for_sale''
      AND sie."name" = ''Activo''
)
SELECT json_build_object(
    ''id'', i.id,
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''establishment'', json_build_object(
        ''id'', e.id,
        ''name'', e."name"
    ),
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', oe.ie_id,
                ''element_type'', oe.element_type,
                ''quantity'', oe.quantity,
                ''status'', json_build_object(
                    ''identifier'', oe.sie_name,
                    ''id'', oe.sie_id
                ),
                ''measure'', json_build_object(
                    ''id'', oe.m_id,
                    ''identifier'', oe.m_name,
                    ''unitBase'', json_build_object(
                        ''quantity'', oe.unit_base_quantity,
                        ''name'', oe.ub_name,
                        ''id'', oe.ub_id
                    )
                ),
                ''productForSale'', json_build_object(
                    ''id'', oe.pfs_id,
                    ''price'', oe.pfs_price,
                    ''finishedProduct'', json_build_object(
                        ''id'', oe.fp_id,
                        ''name'', oe.fp_name,
                        ''photo'', oe.fp_photo,
                        ''status'', json_build_object(
                            ''id'', oe.srm_id,
                            ''identifier'', oe.srm_name
                        ),
                        ''measure'', json_build_object(
                            ''identifier'', oe.ub_name
                        )
                    )
                )
            ) ORDER BY oe.pfs_sort_order NULLS LAST, oe.pfs_creation_date asc
        )
        FROM inventory_elements_ordered oe
        WHERE oe.inventory_id = i.id
    )
) AS json_result
FROM inventory i
LEFT JOIN establishment e ON e.id::text = i.unit_name','inventory','POST'),
	 ('retrieveAllProductForSaleInventoryV2','/retrieveAllProductForSaleInventoryV2','WITH inventory_elements_ordered AS (
    SELECT
        ie.inventory_id,
        ie.id AS ie_id,
        ie.element_type,
        ie.quantity,
        pfs.id AS pfs_id,
        pfs.price AS pfs_price,
        pfs.creation_date AS pfs_creation_date,
        pfs.sort_order AS pfs_sort_order,
        fp.id AS fp_id,
        fp.name AS fp_name,
        fp.photo AS fp_photo,
        m.id AS m_id,
        m.name AS m_name,
        m.unit_base_quantity,
        ub.id AS ub_id,
        ub.name AS ub_name,
        sie.id AS sie_id,
        sie.name AS sie_name,
        srm.id AS srm_id,
        srm.name AS srm_name
    FROM inventory_element ie
    JOIN product_for_sale pfs ON ie.element_fk = pfs.id
    LEFT JOIN finished_product fp ON fp.id = pfs.finished_product_id
    LEFT JOIN status sie ON sie.id = pfs.status_id
    LEFT JOIN measure m ON m.id = ie.measure_id
    LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
    LEFT JOIN status srm ON srm.id = fp.status_id
    WHERE ie.element_type = ''product_for_sale''
      AND sie."name" = ''Activo''
)
SELECT json_agg(
    json_build_object(
        ''id'', i.id,
        ''inventoryType'', i.inventory_type,
        ''unitName'', i.unit_name,
        ''creationDate'', i.creation_date,
        ''establishment'', json_build_object(
            ''id'', e.id,
            ''name'', e."name"
        ),
        ''inventoryElements'', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    ''id'', oe.ie_id,
                    ''element_type'', oe.element_type,
                    ''quantity'', oe.quantity,
                    ''status'', json_build_object(
                        ''identifier'', oe.sie_name,
                        ''id'', oe.sie_id
                    ),
                    ''measure'', json_build_object(
                        ''id'', oe.m_id,
                        ''identifier'', oe.m_name,
                        ''unitBase'', json_build_object(
                            ''quantity'', oe.unit_base_quantity,
                            ''name'', oe.ub_name,
                            ''id'', oe.ub_id
                        )
                    ),
                    ''productForSale'', json_build_object(
                        ''id'', oe.pfs_id,
                        ''price'', oe.pfs_price,
                        ''finishedProduct'', json_build_object(
                            ''id'', oe.fp_id,
                            ''name'', oe.fp_name,
                            ''photo'', oe.fp_photo,
                            ''status'', json_build_object(
                                ''id'', oe.srm_id,
                                ''identifier'', oe.srm_name
                            ),
                            ''measure'', json_build_object(
                                ''identifier'', oe.ub_name
                            )
                        )
                    )
                ) ORDER BY oe.pfs_sort_order NULLS LAST, oe.pfs_creation_date ASC
            ), ''[]''::json)
            FROM inventory_elements_ordered oe
            WHERE oe.inventory_id = i.id
        )
    )
) AS json_result
FROM inventory i
INNER JOIN establishment e ON e.id::text = i.unit_name','inventory','POST');

-- Version reducida de /getProductForSaleStoreOrder para la exportacion a PDF, compartida por las
-- vistas de fabrica y de tienda: devuelve unicamente los campos que se imprimen. Los precios se
-- incluyen porque el formato de tienda los imprime; el de fabrica simplemente no los usa.
-- Se filtra por id con el mecanismo estandar de filtros: {"pfsso": {"id": "..."}}
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getProductForSaleStoreOrderForPdf','/getProductForSaleStoreOrderForPdf','SELECT json_build_object(
    ''id'', pfsso.id,
    ''name'', pfsso.name,
    ''comment'', pfsso.comment,
    ''finalAmount'', pfsso.final_amount,
    ''creationDate'', pfsso.creation_date,
    ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
    ''establishment'', json_build_object(
        ''name'', e."name"
    ),
    ''storeStatus'', json_build_object(
        ''identifier'', s.name
    ),
    ''factoryStatus'', json_build_object(
        ''identifier'', s2.name
    ),
    ''productForSaleStoreOrderElements'', (
        SELECT json_agg(
            json_build_object(
                ''quantity'', pfssoe.quantity,
                ''price'', pfssoe.price,
                ''totalPrice'', pfssoe.total_price,
                ''measure'', json_build_object(
                    ''identifier'', m.name
                ),
                ''productForSale'', json_build_object(
                    ''finishedProduct'', json_build_object(
                        ''name'', fp.name
                    )
                )
            )
            --ORDER BY fp.sort_order NULLS LAST, fp.name
        )
        FROM product_for_sale_store_order_element pfssoe
        LEFT JOIN product_for_sale pfs ON pfs.id = pfssoe.product_for_sale_id
        LEFT JOIN finished_product fp ON fp.id = pfs.finished_product_id
        LEFT JOIN measure m ON m.id = pfssoe.measure_id
        WHERE pfssoe.pfsso_id = pfsso.id
    )
) as json_result
from product_for_sale_store_order pfsso
left join establishment e on e.id = pfsso.establishment_id
left join status s on s.id = pfsso.store_status_id
left join status s2 on s2.id = pfsso.factory_status_id','product_for_sale_store_order','POST');

-- Costo por producto para venta (product_for_sale.cost), visible/editable solo por el rol Sistema.
-- Las queries de lectura son clones de /retrieveProductsForSaleV3 y /getProductForSale con `cost`
-- agregado, en endpoints aparte: el front solo los llama cuando el usuario es Sistema, asi el
-- payload de un usuario de tienda no lleva el costo. Es ocultamiento, no control de acceso: el
-- backend no valida rol, cualquier usuario autenticado podria llamarlos a mano.
-- Ver src/database/migrations/2026-07-27-add-product-for-sale-cost.sql
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveProductsForSaleV4','/retrieveProductsForSaleV4','WITH products_ordered AS (
    SELECT pfs1.id, pfs1.creation_date, pfs1.updated_date, pfs1.price, pfs1.cost, pfs1.sort_order,
           fp.id AS fp_id, fp.name AS fp_name, fp.photo, fp.thumb, fp.description,
           ub.name AS ub_name, ub."type" AS ub_type,
           s.name AS s_name, s.id as status_id, s."type" AS s_type,
           e.id AS establishment_id, e.name AS e_name
    FROM product_for_sale pfs1
    LEFT JOIN finished_product fp ON pfs1.finished_product_id = fp.id
    LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
    LEFT JOIN establishment e ON e.id = pfs1.establishment_id
    LEFT JOIN status s ON s.id = pfs1.status_id
)
SELECT json_agg(
    json_build_object(
        ''id'', pfs.id,
        ''creationDate'', pfs.creation_date,
        ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
        ''price'', pfs.price,
        ''cost'', pfs.cost,
        ''sortOrder'', pfs.sort_order,
        ''finishedProduct'', json_build_object(
            ''id'', pfs.fp_id,
            ''name'', pfs.fp_name,
            ''photo'', pfs.photo,
            ''thumb'', pfs.thumb,
            ''description'', pfs.description,
            ''measure'', json_build_object(
                ''identifier'', pfs.ub_name,
                ''type'', pfs.ub_type
            )
        ),
        ''status'', json_build_object(
        	''id'', pfs.status_id,
            ''name'', pfs.s_name,
            ''type'', pfs.s_type
        ),
        ''establishment'', json_build_object(
            ''id'', pfs.establishment_id,
            ''name'', pfs.e_name
        )
    )
    ORDER BY pfs.sort_order NULLS LAST, pfs.creation_date
) AS json_result
FROM products_ordered pfs','product_for_sale','POST'),
	 ('getProductForSaleWithCost','/getProductForSaleWithCost','SELECT json_build_object(
    ''id'', pfs.id,
    ''price'', pfs.price,
    ''cost'', pfs.cost,
    ''creationDate'', pfs.creation_date,
    ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
    ''finishedProduct'', json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''photo'', fp.photo,
        ''description'', fp.description,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        )
    ),
    ''status'', json_build_object(
        ''name'', s.name,
        ''identifier'', s.name,
        ''type'', s."type"
    ),
    ''establishment'', json_build_object(
        ''id'', e.id,
        ''name'', e.name
    ),
    ''creatorUser'', json_build_object(
        ''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM product_for_sale pfs
LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
LEFT JOIN establishment e ON e.id = pfs.establishment_id
LEFT JOIN status s ON s.id = pfs.status_id
left join "user" u on u.id = pfs.creator_user_id','product_for_sale','POST'),
	 ('updateProductForSaleCost','/updateProductForSaleCost','update product_for_sale
set cost = $1::numeric, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $2::uuid','product_for_sale','PATCH'),
	 ('updateManyProductForSaleCost','/updateManyProductForSaleCost','UPDATE product_for_sale AS pfs
SET cost = v.cost, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
FROM jsonb_to_recordset($1::jsonb) AS v(id uuid, cost numeric)
WHERE pfs.id = v.id','product_for_sale','PATCH');
